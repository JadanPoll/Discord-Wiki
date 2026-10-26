"""Book-oriented projection of a Discord corpus.

The goal is not to classify a community correctly. It is to compile the same
source evidence into a reading surface that helps a person act on an intention:
orient, browse, learn, investigate, and descend to original messages.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import json
import math
import re

from .core import URL, good_token, tokens


PROJECTIONS = {
    "casebook": {
        "label": "Casebook",
        "grammar": "case-first",
        "topology": "case network",
        "purpose": "compare concrete technical episodes, diagnoses, and outcomes",
    },
    "problem_book": {
        "label": "Problem book / troubleshooting manual",
        "grammar": "problem-first",
        "topology": "problem lattice",
        "purpose": "move from recurring problems to attempts, fixes, and boundary cases",
    },
    "project_book": {
        "label": "Project book / workshop notebook",
        "grammar": "project-first",
        "topology": "constructive ladder",
        "purpose": "learn from builds, implementations, revisions, and artifacts",
    },
    "atlas": {
        "label": "Atlas / showcase catalog",
        "grammar": "example-first",
        "topology": "atlas",
        "purpose": "browse concrete artifacts and recognize useful exemplars quickly",
    },
    "handbook": {
        "label": "Handbook / reference",
        "grammar": "modular reference",
        "topology": "reference lookup",
        "purpose": "jump directly to recurring subjects, techniques, and examples",
    },
    "sourcebook": {
        "label": "Sourcebook / proceedings",
        "grammar": "source-first",
        "topology": "source constellation",
        "purpose": "navigate primary discussions, references, and competing accounts",
    },
    "research_notes": {
        "label": "Frontier notes / research notebook",
        "grammar": "inquiry-first",
        "topology": "branching investigation",
        "purpose": "follow tentative ideas, experiments, unresolved questions, and revisions",
    },
    "methods": {
        "label": "Methods / cookbook",
        "grammar": "procedure-first",
        "topology": "reference lookup",
        "purpose": "recover practical recipes, fixes, and implementation moves",
    },
}

BUILD_RE = re.compile(
    r"\b(build|built|building|prototype|design|implement|implementation|driver|"
    r"circuit|schematic|board|hardware|software|code|setup|install|flash)\b", re.I)
PROBLEM_RE = re.compile(
    r"\b(error|issue|broken|failure|failed|failing|fix|debug|problem|stuck|"
    r"doesn.?t work|not working|why|help)\b", re.I)
RESEARCH_RE = re.compile(
    r"\b(test|tested|testing|experiment|measure|measurement|result|results|"
    r"compare|comparison|hypothesis|observed|observation|investigat|maybe|possible)\w*", re.I)
CODE_RE = re.compile(
    r"(^|\n)\s*(?:\$|>|python\b|pip\b|git\b|sudo\b|npm\b|cargo\b|gcc\b|"
    r"cmake\b|make\b|SELECT\b|INSERT\b)", re.I)


def profile(library, did):
    """Recommend a useful book/reference projection from cheap structural signals."""
    rows = library.db.execute(
        "SELECT author,content,reply_to,attachments FROM messages WHERE dataset_id=?",
        (did,)).fetchall()
    n = len(rows)
    if not n:
        return {
            "headline": "Reference",
            "primary": PROJECTIONS["handbook"],
            "secondary": None,
            "topology": "reference lookup",
            "why": ["No messages are available to infer a richer projection."],
            "signals": {},
            "boundary": "Interface projection only; not a claim about community purpose.",
        }

    counts = Counter()
    authors = Counter()
    for row in rows:
        content = row["content"] or ""
        authors[row["author"] or "unknown"] += 1
        counts["reply"] += bool(row["reply_to"])
        counts["question"] += "?" in content
        try:
            counts["attachment"] += bool(json.loads(row["attachments"] or "[]"))
        except (TypeError, ValueError):
            counts["attachment"] += row["attachments"] not in ("", "[]", None)
        counts["link"] += bool(URL.search(content))
        counts["code"] += ("\x60\x60\x60" in content or content.count("\x60") >= 2
                           or bool(CODE_RE.search(content)))
        counts["longform"] += len(content) >= 280
        counts["build"] += bool(BUILD_RE.search(content))
        counts["problem"] += bool(PROBLEM_RE.search(content))
        counts["research"] += bool(RESEARCH_RE.search(content))

    recurring = library.db.execute(
        "SELECT COUNT(DISTINCT message_id) AS n FROM term_refs WHERE dataset_id=?",
        (did,)).fetchone()["n"]
    s = {k + "_rate": counts[k] / n for k in
         ("reply", "question", "attachment", "link", "code", "longform",
          "build", "problem", "research")}
    s["recurring_subject_coverage"] = recurring / n
    s["author_diversity"] = min(1.0, len(authors) / max(5.0, math.sqrt(n)))

    # Weak signals choose a reading topology. They are routing priors, not truth.
    scores = {
        "casebook": 2.2*s["reply_rate"] + 1.25*s["question_rate"]
                    + 1.35*s["problem_rate"] + .35*s["longform_rate"],
        "problem_book": 1.85*s["question_rate"] + 1.7*s["problem_rate"]
                        + .9*s["reply_rate"],
        "project_book": 1.65*s["build_rate"] + 1.25*s["attachment_rate"]
                        + .75*s["code_rate"] + .35*s["reply_rate"],
        "atlas": 2.55*s["attachment_rate"] + .35*s["build_rate"]
                 + .25*max(0.0, .15-s["reply_rate"]),
        "handbook": 2.05*s["recurring_subject_coverage"]
                    + .25*s["author_diversity"] + .2*s["link_rate"],
        "sourcebook": 1.75*s["link_rate"] + .75*s["longform_rate"]
                      + .3*s["author_diversity"],
        "research_notes": 1.5*s["research_rate"] + .9*s["question_rate"]
                          + .7*s["longform_rate"] + .55*s["reply_rate"],
        "methods": 1.25*s["build_rate"] + 1.15*s["problem_rate"]
                   + .65*s["code_rate"],
    }
    ranked = sorted(scores, key=lambda k: (-scores[k], k))
    pkey, skey = ranked[0], ranked[1]
    primary = {**PROJECTIONS[pkey], "key": pkey, "score": round(scores[pkey], 3)}
    secondary = {**PROJECTIONS[skey], "key": skey, "score": round(scores[skey], 3)}
    show_secondary = scores[skey] >= scores[pkey] * .58
    headline = primary["label"] + ((" + " + secondary["label"]) if show_secondary else "")
    topology = primary["topology"]
    if show_secondary and secondary["topology"] != topology:
        topology += " + " + secondary["topology"]

    why = []
    if s["reply_rate"] >= .10:
        why.append("many messages participate in explicit reply-linked exchanges")
    if s["question_rate"] >= .08 or s["problem_rate"] >= .10:
        why.append("questions and troubleshooting language recur")
    if s["attachment_rate"] >= .08:
        why.append("attachments are a substantial part of the record")
    if s["build_rate"] >= .10 or s["code_rate"] >= .05:
        why.append("build, implementation, or code-oriented discussion is common")
    if s["research_rate"] >= .10:
        why.append("testing, comparison, and tentative reasoning recur")
    if s["recurring_subject_coverage"] >= .35:
        why.append("recurring subjects provide a strong lookup backbone")
    if s["link_rate"] >= .06:
        why.append("external references are common enough to matter")
    if not why:
        why.append("a non-linear source-grounded reference is the safest default")

    return {
        "headline": headline,
        "primary": primary,
        "secondary": secondary if show_secondary else None,
        "topology": topology,
        "why": why[:4],
        "signals": {k: round(v, 3) for k, v in s.items()},
        "boundary": (
            "Recommended reading/interface projection inferred from corpus structure; "
            "not a claim about the community's purpose, authority, or truth."
        ),
    }


def _refs(library, did):
    out = defaultdict(set)
    for row in library.db.execute(
            "SELECT term,message_id FROM term_refs WHERE dataset_id=?", (did,)):
        out[row["term"]].add(row["message_id"])
    return out


def _oneoffs(library, did, covered, limit=24):
    ranked = []
    rows = library.db.execute(
        "SELECT id,content,attachments FROM messages WHERE dataset_id=? ORDER BY ordinal",
        (did,)).fetchall()
    for row in rows:
        if row["id"] in covered:
            continue
        content = row["content"] or ""
        try:
            attachments = json.loads(row["attachments"] or "[]")
        except (TypeError, ValueError):
            attachments = []
        score = (3 if attachments else 0) + (2 if URL.search(content) else 0)
        score += min(2.5, len({t for t in tokens(content) if good_token(t)}) / 12)
        score += 1 if len(content) >= 180 else 0
        if score >= 2.3:
            ranked.append((-score, row["id"]))
    ranked.sort()
    return [library.message(did, mid) for _, mid in ranked[:limit]]


def chapters(library, did, limit=8):
    """Build chapter-like headings from phrase subjects, then retain the messy glossary.

    The contents page should read like an editor chose subjects, not like a bag of
    high-frequency words. Overlap is tolerated; a textbook index is not a partition.
    """
    rows = [dict(r) for r in library.db.execute(
        "SELECT term,df,kind,score FROM terms WHERE dataset_id=? ORDER BY score DESC,term",
        (did,))]
    refs = _refs(library, did)
    phrases = [r for r in rows if r["kind"] == "phrase"][:120]
    seeds = phrases[:60]

    candidates = []
    for seed in seeds:
        seed_ids = refs.get(seed["term"], set())
        if not seed_ids:
            continue
        seed_words = set(seed["term"].split())
        related = []
        for other in phrases:
            if other["term"] == seed["term"]:
                continue
            other_ids = refs.get(other["term"], set())
            if not other_ids:
                continue
            inter = len(seed_ids & other_ids)
            co = inter / max(1, min(len(seed_ids), len(other_ids)))
            other_words = set(other["term"].split())
            lexical = len(seed_words & other_words) / max(
                1, min(len(seed_words), len(other_words)))
            relation = 1.4*co + .85*lexical
            if relation >= .48:
                related.append((relation, other))
        related.sort(key=lambda x: (-x[0], -x[1]["df"], x[1]["term"]))
        related = related[:6]
        ids = set(seed_ids)
        for _, item in related:
            ids |= refs.get(item["term"], set())
        # Prefer headings that recur and also open onto nearby related material.
        strength = math.log1p(seed["df"]) + .55*sum(x[0] for x in related[:4])
        candidates.append({
            "key": seed["term"],
            "title": seed["term"],
            "source_count": len(ids),
            "subtopics": [item["term"] for _, item in related[:5]],
            "_ids": ids,
            "_strength": strength,
        })

    candidates.sort(key=lambda x: (-x["_strength"], -x["source_count"], x["title"]))
    chosen = []
    for candidate in candidates:
        if len(chosen) >= limit:
            break
        if any(len(candidate["_ids"] & prior["_ids"]) /
               max(1, min(len(candidate["_ids"]), len(prior["_ids"]))) >= .72
               for prior in chosen):
            continue
        chosen.append(candidate)

    covered = set()
    for phrase in phrases:
        covered |= refs.get(phrase["term"], set())
    oneoffs = _oneoffs(library, did, covered)
    if oneoffs:
        chosen.append({
            "key": "__oneoffs__",
            "title": "One-off projects & artifacts",
            "source_count": len(oneoffs),
            "subtopics": ["rare builds", "attachments", "distinctive source posts"],
            "_ids": {m["id"] for m in oneoffs},
            "_strength": 0,
        })
    return chosen

def view(library, did):
    if not library.db.execute("SELECT 1 FROM datasets WHERE id=?", (did,)).fetchone():
        raise ValueError("Unknown imported dataset.")
    return {
        "profile": profile(library, did),
        "chapters": [{k: v for k, v in c.items() if not k.startswith("_")}
                     for c in chapters(library, did)],
        "glossary_count": library.db.execute(
            "SELECT COUNT(*) AS n FROM terms WHERE dataset_id=?", (did,)).fetchone()["n"],
    }


def chapter_messages(library, did, key, limit=60):
    chapter = next((x for x in chapters(library, did) if x["key"] == key), None)
    if not chapter:
        return []
    if key == "__oneoffs__":
        return _oneoffs(library, did, set(), limit)
    ids = list(chapter["_ids"])
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    rows = library.db.execute(
        "SELECT id FROM messages WHERE dataset_id=? AND id IN (" + placeholders +
        ") ORDER BY ordinal LIMIT ?",
        [did] + ids + [min(100, max(1, int(limit)))],
    ).fetchall()
    return [library.message(did, row["id"]) for row in rows]


def orient(library, did, question, limit=3):
    """Question-relative entry points into the compiled book surface."""
    q = set(tokens(question))
    if not q:
        return []
    scored = []
    for chapter in chapters(library, did):
        words = set(tokens(chapter["title"] + " " + " ".join(chapter["subtopics"])))
        overlap = len(q & words)
        if overlap:
            scored.append((overlap, chapter["source_count"], chapter))
    scored.sort(key=lambda x: (-x[0], -x[1], x[2]["title"]))
    return [{k: v for k, v in c.items() if not k.startswith("_")}
            for _, _, c in scored[:limit]]
