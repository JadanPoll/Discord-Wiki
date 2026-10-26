"""Localhost web and desktop shell: one code path, no external server required."""
from __future__ import annotations
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import threading
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
import webbrowser

from .core import Library, MAX_IMPORT_BYTES
from .librarian import Librarian

WEB = Path(__file__).parent / "web"


def serve(host="127.0.0.1", port=8767, data=None, browser=True):
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("This MVP has no remote-user authentication. Bind to localhost only.")
    library = Library(data or Path.home() / ".discord_wiki" / "library.sqlite3")
    librarian = Librarian(library)
    db_lock = threading.RLock()

    class Handler(BaseHTTPRequestHandler):
        server_version = "DiscordWiki/0.1"

        def _send(self, status, raw, kind="application/json; charset=utf-8"):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'")
            self.end_headers()
            try:
                self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def _json(self, obj, status=200):
            self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

        def do_GET(self):
            path = urlsplit(self.path)
            q = parse_qs(path.query)
            one = lambda k: q.get(k, [""])[0]
            try:
                with db_lock:
                    if path.path == "/api/datasets":
                        return self._json({"datasets": library.datasets()})
                    if path.path == "/api/index":
                        return self._json({"topics": library.index(one("dataset"))})
                    if path.path == "/api/term":
                        return self._json({"messages": library.term_messages(one("dataset"), one("term"))})
                    if path.path == "/api/context":
                        return self._json({"messages": library.context(one("dataset"), one("message"))})
                    if path.path == "/api/history":
                        return self._json({"history": librarian.history(one("dataset"))})
                filename = "index.html" if path.path in ("/", "/index.html") else path.path.removeprefix("/")
                if filename not in ("index.html", "style.css", "app.js"):
                    return self._json({"error": "Not found"}, 404)
                raw = (WEB / filename).read_bytes()
                kind = mimetypes.guess_type(filename)[0] or "application/octet-stream"
                return self._send(200, raw, kind + "; charset=utf-8")
            except (ValueError, OSError) as e:
                return self._json({"error": str(e)}, 400)

        def do_POST(self):
            path = urlsplit(self.path).path
            origin = self.headers.get("Origin")
            allowed = {"http://localhost:" + str(port), "http://127.0.0.1:" + str(port)}
            if origin and origin not in allowed:
                return self._json({"error": "Cross-origin changes are not allowed."}, 403)
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self._json({"error": "Expected application/json."}, 415)
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > MAX_IMPORT_BYTES:
                    return self._json({"error": "Request is empty or exceeds the 100 MB limit."}, 413)
                raw = self.rfile.read(length)
                with db_lock:
                    if path == "/api/import":
                        filename = unquote(self.headers.get("X-Filename", "import.json"))
                        if not filename.lower().endswith(".json"):
                            raise ValueError("Choose a Discord JSON export.")
                        return self._json(library.import_bytes(raw, Path(filename).name))
                    if path == "/api/investigate":
                        payload = json.loads(raw)
                        if not isinstance(payload, dict):
                            raise ValueError("Expected a JSON object.")
                        return self._json(librarian.investigate(
                            payload.get("dataset", ""), payload.get("question", ""),
                            payload.get("parent_id"), payload.get("reason") is True))
                return self._json({"error": "Not found"}, 404)
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as e:
                return self._json({"error": str(e)}, 400)
            except Exception:
                # Do not expose local data or API credentials in error traces.
                return self._json({"error": "Internal error; inspect local server logs."}, 500)

    httpd = ThreadingHTTPServer((host, port), Handler)
    url = "http://127.0.0.1:" + str(httpd.server_port)
    print("Discord-Wiki: " + url)
    print("Local database: " + str(library.path))
    print("Stop with Ctrl+C. Model reasoning requires explicit opt-in.")
    if browser:
        threading.Timer(0.3, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        library.close()


def main():
    parser = argparse.ArgumentParser(description="Discord-Wiki RSM investigation workspace")
    parser.add_argument("--port", type=int, default=8767)
    parser.add_argument("--host", default="127.0.0.1", help="localhost only")
    parser.add_argument("--data", help="SQLite database path")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    serve(args.host, args.port, args.data, not args.no_browser)


if __name__ == "__main__":
    main()
