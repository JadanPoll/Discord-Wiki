"""End-to-end localhost smoke test; no browser, API key or third-party libraries."""
import json
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class TestHTTP(unittest.TestCase):
    def test_import_investigate_and_source_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            sock = socket.socket()
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
            sock.close()
            proc = subprocess.Popen(
                [sys.executable, "-u", "-m", "discord_wiki", "--port", str(port),
                 "--data", str(Path(tmp) / "state.sqlite3"), "--no-browser"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            base = "http://127.0.0.1:" + str(port)
            try:
                for _ in range(70):
                    if proc.poll() is not None:
                        self.fail("Server exited early: " + proc.stdout.read())
                    try:
                        with urlopen(base + "/", timeout=0.5) as resp:
                            self.assertIn("Discord-Wiki", resp.read().decode())
                        break
                    except (URLError, TimeoutError):
                        time.sleep(0.1)
                else:
                    self.fail("Local server did not start")
                raw = json.dumps({"messages": [
                    {"id": "555", "content": "Kinect depth sensor calibration",
                     "timestamp": "2025-01-01T12:00:00Z",
                     "author": {"username": "person"}},
                    {"id": "556", "content": "Kinect depth sensor alignment",
                     "timestamp": "2025-01-01T12:01:00Z",
                     "author": {"username": "other"}}
                ]}).encode()
                def post(path, payload, headers=None):
                    req = Request(base + path, data=payload,
                                  headers={"Content-Type": "application/json", **(headers or {})},
                                  method="POST")
                    with urlopen(req, timeout=10) as response:
                        return json.load(response)
                ds = post("/api/import", raw, {"X-Filename": "kinect.json"})
                did = ds["id"]
                with urlopen(base + "/api/datasets") as response:
                    self.assertEqual(json.load(response)["datasets"][0]["id"], did)
                answer = post("/api/investigate", json.dumps(
                    {"dataset": did, "question": "Kinect depth sensor?", "reason": False}).encode())
                self.assertIsNone(answer["interpretation"])
                self.assertEqual({m["id"] for m in answer["evidence"]}, {"555", "556"})
                with urlopen(base + "/api/context?dataset=" + did + "&message=555") as response:
                    self.assertEqual(json.load(response)["messages"][0]["id"], "555")
                # A scalar list is readable but semantically ambiguous. The
                # program asks for intent instead of silently calling it chat.
                try:
                    post("/api/import", b'["kinect","sensor"]', {"X-Filename": "words.json"})
                    self.fail("Ambiguous scalar array should request mapping")
                except HTTPError as error:
                    self.assertEqual(error.code, 422)
                    payload = json.load(error)
                    self.assertTrue(payload["mapping_required"])
                    candidate = payload["inspection"]["candidates"][0]
                mapping = {
                    "record_path": candidate["record_path"],
                    "fields": {"content": ["$value"]},
                }
                mapped = post(
                    "/api/import", b'["kinect","sensor"]',
                    {"X-Filename": "words.json",
                     "X-Import-Mapping": quote(json.dumps(mapping), safe="")})
                self.assertEqual(mapped["count"], 2)
                try:
                    post("/api/investigate", b'{}', {"Origin": "https://attacker.example"})
                    self.fail("Foreign-origin API write should be rejected")
                except HTTPError as error:
                    self.assertEqual(error.code, 403)
            finally:
                proc.terminate()
                try:
                    proc.communicate(timeout=4)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.communicate()


if __name__ == "__main__":
    unittest.main()
