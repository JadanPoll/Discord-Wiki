import json
import tempfile
import unittest
from pathlib import Path

from discord_wiki.core import Library, normalize_export
from discord_wiki.librarian import Librarian, mode_for


def fixture():
    return json.dumps({
        "channel": {"name": "redstone", "id": "456"},
        "messages": [
            {"id": "1", "timestamp": "2025-01-01T12:00:00Z",
             "author": {"username": "builder"}, "content": "Redstone comparator circuits use signals."},
            {"id": "2", "timestamp": "2025-01-01T12:01:00Z",
             "author": {"username": "helper"}, "content": "The redstone comparator fails on this build.",
             "message_reference": {"message_id": "1"}},
            {"id": "3", "timestamp": "2025-01-01T12:02:00Z",
             "author": {"username": "tester"}, "content": "I tried changing the comparator. It worked on my machine.",
             "attachments": [{"filename": "circuit.png"}]},
            {"id": "4", "timestamp": "2025-01-01T12:03:00Z",
             "author": {"username": "builder"}, "content": "Another comparator test is needed."}
        ]
    }).encode()


class TestCore(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.library = Library(Path(self.tmp.name) / "test.sqlite3")
        self.raw = fixture()
        self.result = self.library.import_bytes(self.raw, "redstone.json")
        self.did = self.result["id"]

    def tearDown(self):
        self.library.close()
        self.tmp.cleanup()

    def test_roundtrip_and_dedupe(self):
        self.assertEqual(self.result["count"], 4)
        self.assertTrue(self.library.import_bytes(self.raw, "redstone.json")["cached"])
        self.assertEqual(len(self.library.context(self.did, "2", radius=1)), 3)
        self.assertEqual(self.library.message(self.did, "2")["reply_to"], "1")
        self.assertEqual(self.library.message(self.did, "3")["attachments"], ["circuit.png"])

    def test_index_has_real_backreferences(self):
        topics = self.library.index(self.did)
        self.assertTrue(any(x["term"] == "comparator" for x in topics))
        refs = self.library.term_messages(self.did, "comparator")
        self.assertEqual({x["id"] for x in refs}, {"1", "2", "3", "4"})

    def test_search_references_only_original_ids(self):
        results = self.library.search(self.did, "redstone comparator")
        self.assertTrue(results)
        self.assertTrue({r["id"] for r in results} <= {"1", "2", "3", "4"})

    def test_librarian_no_fabricated_answer(self):
        agent = Librarian(self.library)
        a = agent.investigate(self.did, "Was the comparator fix confirmed?", reason=False)
        self.assertEqual(a["mode"], "verify")
        self.assertIsNone(a["interpretation"])
        self.assertIn(a["coverage"], ("candidate_evidence", "no_match"))
        self.assertEqual(agent.history(self.did)[0]["id"], a["id"])
        b = agent.investigate(self.did, "What was tested next?", parent_id=a["id"])
        self.assertEqual(b["root_goal"], a["root_goal"])

    def test_no_match_not_contradiction(self):
        a = Librarian(self.library).investigate(self.did, "quasarzylop", reason=False)
        self.assertEqual(a["coverage"], "no_match")
        self.assertEqual(a["evidence"], [])

    def test_dce_and_list_formats(self):
        data = {"messages": [{"id": "8", "author": {"name": "A"}, "content": "Kinect depth"}]}
        did, name, items = normalize_export(json.dumps(data).encode(), "dce.json")
        self.assertEqual(items[0]["author"], "A")
        self.assertEqual(items[0]["content"], "Kinect depth")
        did, name, items = normalize_export(json.dumps([{"id": "9", "content": "LC3"}]).encode(), "flat.json")
        self.assertEqual(items[0]["id"], "9")

    def test_route_and_bad_json(self):
        self.assertEqual(mode_for("compare two implementations"), "compare")
        with self.assertRaises(ValueError):
            normalize_export(b"{invalid", "bad.json")


if __name__ == "__main__":
    unittest.main()
