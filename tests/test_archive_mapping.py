import json
import tempfile
import unittest
from pathlib import Path

from discord_wiki.archive_mapping import ImportMappingRequired, inspect_archive, normalize_archive
from discord_wiki.core import Library, normalize_export


class ArchiveMappingTests(unittest.TestCase):
    def test_anonymous_timestampless_archive_is_valid(self):
        raw = json.dumps({
            "data": {"entries": [
                {"body": "first stripped message"},
                {"body": "second stripped message"},
            ]}
        }).encode()
        _, _, messages = normalize_export(raw, "stripped.json")
        self.assertEqual([m["content"] for m in messages],
                         ["first stripped message", "second stripped message"])
        self.assertEqual([m["author"] for m in messages], ["unknown", "unknown"])
        self.assertEqual([m["ts"] for m in messages], ["", ""])
        self.assertTrue(all(len(m["id"]) == 20 for m in messages))

    def test_jsonl_and_csv_are_record_formats_not_special_cases(self):
        jsonl = b'{"body":"alpha"}\n{"body":"beta"}\n'
        _, _, messages = normalize_export(jsonl, "chat.jsonl")
        self.assertEqual([m["content"] for m in messages], ["alpha", "beta"])

        csv_raw = b"content\nhello\nworld\n"
        _, _, messages = normalize_export(csv_raw, "chat.csv")
        self.assertEqual([m["content"] for m in messages], ["hello", "world"])

    def test_explicit_messages_string_list_self_heals(self):
        raw = json.dumps({"messages": ["alpha stripped message", "beta stripped message"]}).encode()
        _, _, messages = normalize_export(raw, "stripped.json")
        self.assertEqual([m["content"] for m in messages],
                         ["alpha stripped message", "beta stripped message"])
        self.assertEqual([m["author"] for m in messages], ["unknown", "unknown"])
        self.assertEqual([m["ts"] for m in messages], ["", ""])

    def test_scalar_list_requires_human_intent(self):
        raw = json.dumps(["first message", "second message"]).encode()
        with self.assertRaises(ImportMappingRequired) as ctx:
            normalize_archive(raw, "stripped.json")
        candidate = ctx.exception.inspection["candidates"][0]
        self.assertEqual(candidate["record_kind"], "value")
        mapping = {
            "record_path": candidate["record_path"],
            "fields": {"content": ["$value"]},
        }
        _, _, messages, info = normalize_archive(raw, "stripped.json", mapping)
        self.assertEqual([m["content"] for m in messages],
                         ["first message", "second message"])
        self.assertIn("author", info["missing"])
        self.assertIn("timestamp", info["missing"])

    def test_unknown_field_names_can_be_mapped_by_meaning(self):
        raw = json.dumps({
            "archive": {"rows": [
                {"utterance": "one", "speakerish": "A"},
                {"utterance": "two", "speakerish": "B"},
            ]}
        }).encode()
        inspection = inspect_archive(raw, "odd.json")
        candidate = next(c for c in inspection["candidates"] if c["label"] == "archive.rows")
        mapping = {
            "record_path": candidate["record_path"],
            "fields": {
                "content": ["utterance"],
                "author": ["speakerish"],
            },
        }
        _, _, messages, _ = normalize_archive(raw, "odd.json", mapping)
        self.assertEqual(messages[0]["author"], "A")
        self.assertEqual(messages[1]["content"], "two")

    def test_attachments_can_be_the_only_payload(self):
        raw = json.dumps([{"files": ["photo.png"]}, {"files": ["diagram.jpg"]}]).encode()
        _, _, messages = normalize_export(raw, "media.json")
        self.assertEqual(messages[0]["content"], "")
        self.assertEqual(messages[0]["attachments"], ["photo.png"])

    def test_mapping_is_part_of_dataset_identity(self):
        raw = json.dumps([
            {"left": "alpha", "right": "one"},
            {"left": "beta", "right": "two"},
        ]).encode()
        a = {"record_path": [], "fields": {"content": ["left"]}}
        b = {"record_path": [], "fields": {"content": ["right"]}}
        did_a, _, _, _ = normalize_archive(raw, "same.json", a)
        did_b, _, _, _ = normalize_archive(raw, "same.json", b)
        self.assertNotEqual(did_a, did_b)

    def test_library_accepts_manual_mapping_without_metadata(self):
        raw = json.dumps([{"utterance": "alpha"}, {"utterance": "beta"}]).encode()
        mapping = {"record_path": [], "fields": {"content": ["utterance"]}}
        with tempfile.TemporaryDirectory() as tmp:
            library = Library(Path(tmp) / "mapped.sqlite3")
            try:
                result = library.import_bytes(raw, "mapped.json", mapping)
                self.assertEqual(result["count"], 2)
                first = library.message(result["id"],
                    normalize_archive(raw, "mapped.json", mapping)[2][0]["id"])
                self.assertEqual(first["author"], "unknown")
                self.assertEqual(first["ts"], "")
            finally:
                library.close()


if __name__ == "__main__":
    unittest.main()
