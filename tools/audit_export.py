"""Offline admissibility and retrieval audit for authorized Discord exports.

Examples:
  python tools/audit_export.py path/to/channel.json
  python tools/audit_export.py path/to/channel.json --questions tests/questions.jsonl
Question JSONL: {"question":"...", "expected_ids":["123","456"]}
"""
import argparse
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from discord_wiki.core import Library


def main():
    p = argparse.ArgumentParser()
    p.add_argument("export", type=Path)
    p.add_argument("--questions", type=Path, help="Optional human-reviewed answerable questions JSONL")
    p.add_argument("--top", type=int, default=20)
    args = p.parse_args()
    t0 = time.perf_counter()
    library = Library(":memory:")
    source = args.export.read_bytes()
    report = library.import_bytes(source, args.export.name)
    did = report["id"]
    terms = library.index(did, max(1, args.top))
    print(json.dumps({
        "dataset": report["name"], "messages": report["count"],
        "index_terms_displayed": len(terms),
        "seconds": round(time.perf_counter() - t0, 3),
        "top_terms": [{"term": x["term"], "source_messages": x["df"]} for x in terms]
    }, ensure_ascii=False, indent=2))
    if args.questions:
        recall = []
        with args.questions.open(encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                q = json.loads(line)
                expected = set(str(x) for x in q["expected_ids"])
                actual = {m["id"] for m in library.search(did, q["question"], 12)}
                if not expected:
                    raise ValueError("Every evaluated question needs at least one reviewed expected ID.")
                value = len(expected & actual) / len(expected)
                recall.append(value)
                print(json.dumps({"question": q["question"], "recall_at_12": round(value, 3),
                                  "hits": len(expected & actual), "expected": len(expected)},
                                 ensure_ascii=False))
        print(json.dumps({"evaluated_questions": len(recall),
                          "mean_recall_at_12": round(sum(recall)/len(recall), 3) if recall else None}))
    library.close()


if __name__ == "__main__":
    main()
