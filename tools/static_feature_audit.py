#!/usr/bin/env python3
"""Stress-test whether Discord-Wiki's static features see high-information vocabulary.

This is an internal REM audit, not a runtime classifier. It constructs an aggressive
content-word witness set, then asks which cheap static feature families account for
those words. The witness is a proxy for technical/advanced vocabulary; it does not
claim to measure educational level or semantic importance.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from discord_wiki.core import INDEX_STOP, Library, URL, good_token, normalize_export, tokens

COMMON_CONTENT = set("""
actually already always another around basically become becomes became better big bit both
called came can cause change changes clear close come comes common completely course current
different doing done early easy either enough especially even ever every example examples
feel feels few first found further general generally getting give given gives going gone good
great happens hard having idea important include includes including instead keep kind large
last later least less little long look looks made main make makes making many matter means
might mostly much name near never next often okay old once part parts point possible pretty
probably quite rather reason reasons recent same second seems seen several short since small
sometimes still sure take takes taking tell than thing things think though thought together
too true try trying understand use used useful uses using usually very want wanted way ways
well whole without work worked working works would year years
""".split())

RAW_WORD = re.compile(r"[A-Za-z][A-Za-z0-9_+#.-]{2,39}")


def witness(messages):
    """Return aggressive high-information token candidates and document frequency."""
    df = Counter()
    examples = defaultdict(list)
    n = max(1, len(messages))
    for m in messages:
        seen = set()
        for raw in RAW_WORD.findall(URL.sub(" ", m["content"] or "")):
            t = raw.lower().strip("._-")
            if not good_token(t) or t in INDEX_STOP or t in COMMON_CONTENT:
                continue
            if len(t) < 4 and not raw.isupper():
                continue
            seen.add(t)
        for t in seen:
            df[t] += 1
            if len(examples[t]) < 2:
                examples[t].append(m["id"])

    cap = max(5, int(n * 0.10))
    vocab = {t for t, count in df.items() if 2 <= count <= cap}
    return vocab, df, examples


def phrase_vocabulary(messages):
    docs = Counter()
    for m in messages:
        words = [t for t in tokens(m["content"])
                 if good_token(t) and t not in INDEX_STOP and t not in COMMON_CONTENT]
        seen = set()
        for size in (2, 3):
            for i in range(len(words) - size + 1):
                seen.add(tuple(words[i:i+size]))
        docs.update(seen)
    phrases = [p for p, count in docs.items() if count >= 2]
    return set(w for p in phrases for w in p), len(phrases)


def artifact_vocabulary(messages):
    out = set()
    anchors = 0
    for m in messages:
        content = m["content"] or ""
        if not (m.get("attachments") or URL.search(content) or content.count(chr(96)) >= 3):
            continue
        anchors += 1
        out.update(t for t in tokens(content)
                   if good_token(t) and t not in INDEX_STOP and t not in COMMON_CONTENT)
    return out, anchors


def evaluated_static_vocabulary(messages):
    """Reconstruct the cheap vocabulary actually evaluated by core._build_index."""
    repetitions = Counter(
        re.sub(r"\\s+", " ", (m["content"] or "").lower()).strip()
        for m in messages if (m["content"] or "").strip()
    )
    evaluated = set()
    for m in messages:
        canonical = re.sub(r"\\s+", " ", (m["content"] or "").lower()).strip()
        if not canonical or repetitions[canonical] >= 3:
            continue
        evaluated.update(
            t for t in tokens(m["content"])
            if good_token(t) and t not in INDEX_STOP
        )
    return evaluated


def report(path: Path):
    raw = path.read_bytes()
    _, _, messages = normalize_export(raw, path.name)
    lib = Library(":memory:")
    did = lib.import_bytes(raw, path.name)["id"]

    wanted, df, examples = witness(messages)
    evaluated_vocab = evaluated_static_vocabulary(messages)
    current_terms = lib.index(did, 250)
    surfaced_vocab = set()
    for row in current_terms:
        surfaced_vocab.update(tokens(row["term"]))

    phrase_vocab, phrase_labels = phrase_vocabulary(messages)
    artifact_vocab, artifact_anchors = artifact_vocabulary(messages)

    evaluated = wanted & evaluated_vocab
    surfaced = wanted & surfaced_vocab
    families = {
        "evaluated_static_basis": (evaluated_vocab, len(evaluated_vocab)),
        "surfaced_reader_index": (surfaced_vocab, len(current_terms)),
        "recurring_phrase_family": (phrase_vocab, phrase_labels),
        "artifact_anchor_family": (artifact_vocab, artifact_anchors),
        "recurring_singleton_upper_bound": (set(wanted), len(wanted)),
    }
    rows = []
    for name, (covered_vocab, objects) in families.items():
        covered = wanted & covered_vocab
        coverage = len(covered) / max(1, len(wanted))
        rows.append({
            "hypothesis": name,
            "coverage": round(coverage, 4),
            "covered": len(covered),
            "witness_words": len(wanted),
            "feature_objects": objects,
            "coverage_per_100_objects": round(100 * len(covered) / max(1, objects), 2),
        })

    missing_evaluated = sorted(
        (t for t in wanted-evaluated_vocab), key=lambda t: (-df[t], t))
    missing_surfaced = sorted(
        (t for t in wanted-surfaced_vocab), key=lambda t: (-df[t], t))
    evaluated_coverage = len(evaluated) / max(1, len(wanted))
    surfaced_coverage = len(surfaced) / max(1, len(wanted))
    result = {
        "file": path.name,
        "messages": len(messages),
        "witness_definition": (
            "recurring non-common content tokens after aggressive stop filtering; "
            "proxy for high-information technical vocabulary, not educational level"
        ),
        "evaluated_coverage": round(evaluated_coverage, 4),
        "surfaced_coverage": round(surfaced_coverage, 4),
        "verdict": (
            "STATIC_BASIS_SEES_WITNESS; do not add dynamic machinery for vocabulary blindness"
            if evaluated_coverage >= .90 else
            "STATIC_BLIND_SPOT; compare alternative cheap feature families before adding dynamics"
        ),
        "hypotheses": sorted(rows, key=lambda r: (-r["coverage"], r["feature_objects"])),
        "missing_from_static_evaluation": [
            {"term": t, "df": df[t], "example_message_ids": examples[t]}
            for t in missing_evaluated[:40]
        ],
        "not_promoted_to_reader_index": [
            {"term": t, "df": df[t], "example_message_ids": examples[t]}
            for t in missing_surfaced[:40]
        ],
    }
    lib.close()
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json_file", type=Path)
    ap.add_argument("--pretty", action="store_true")
    args = ap.parse_args()
    result = report(args.json_file)
    json.dump(result, sys.stdout, indent=2 if args.pretty else None)
    print()


if __name__ == "__main__":
    main()
