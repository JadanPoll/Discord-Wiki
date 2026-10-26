"""Deterministic Discord export ingestion, search, and index generation.

The index is provisional navigation, not a truth or expertise classifier.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
import re
import sqlite3
from pathlib import Path

MAX_IMPORT_BYTES = 100 * 1024 * 1024
TOKEN = re.compile(r"[a-z0-9][a-z0-9_+#.-]{1,39}", re.I)
URL = re.compile(r"https?://\S+", re.I)
STOP = set("""a about above after again against all also am an and any are arent as at back be because been before being below between both but by can cant could couldn did didnt do does doesnt doing don dont down during each few for from further get gets getting got had has hasnt have havent having he her here hers herself him himself his how i id if ill im in into is isnt it its itself just let lets like lol lmao make me more most much my myself no nor not now of off on once only or other our ours ourselves out over own really right same say says said see she should so some such than that thats the their theirs them themselves then there theres these they this those through to too under until up us very via was wasnt we were werent what whats when where which while who whom why will with wont would wouldnt yeah yes you your yours yourself yourselves okay ok oh hmm hey hi thanks thank please people someone anyone something anything thing things stuff time today tomorrow yesterday way ways one two three four first second new old good bad need needs want wants use using used work works working know knows known think thought maybe probably actually basically pretty quite sure issue issues problem problems question questions answer answers look looks looking try trying tried lot lots kind kinds case cases right better best worst like likee yeahh youre theyre ive doesnt wouldnt couldve isnt youre thats didnt doesnt well gonna wanna got gotta yea yep nope yep idk tbh imo iirc afaik btw fr ngl tbh rn btw edit edited reply message discord channel server user users author conversation chat text comment comments content file files https http www com net org gif png jpg jpeg mp4 webp youtube google link links image images video videos""".split())


# Navigational labels need more aggressive filtering than evidence search.
# These are conversational/function terms, not forbidden words in source messages.
INDEX_STOP = STOP | set("""able already always around based bit build built building buy check
cost cool could couldn different doesn done easy enough even far feel find free fun
getting going good great guys hard help just keeps latest left long made make making
many mean might much need nice obviously okay open people personal possible pretty
project projects really recommend requires right run said send show simple since
something source started still stuff take thanks think though using want worth wow
yeah yet ago darn gosh gotta couldn isnt won havent couldn bad looks looking
feel like gonna guys ready anything everyone available someone kind things
""".split())

# A few words are harmless inside useful phrases but poor standalone glossary headings.
INDEX_TERM_STOP = INDEX_STOP | {"small", "currently", "uses", "everything", "nothing", "seems", "seem"}


def tokens(text: str) -> list[str]:
    cleaned = URL.sub(" ", text or "").lower()
    return [m.group().strip("._-") for m in TOKEN.finditer(cleaned)]


def good_token(t: str) -> bool:
    return 3 <= len(t) <= 35 and t not in STOP and not t.isdigit() and not re.fullmatch(r"[a-f0-9]{16,}", t) and not t.startswith("http")


def _date(value) -> str:
    if not value:
        return ""
    try:
        if isinstance(value, (int, float)):
            dt = datetime.fromtimestamp(value / 1000 if value > 1e11 else value, tz=timezone.utc)
        else:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, OSError, OverflowError, TypeError):
        return str(value)


def normalize_export(raw: bytes, filename: str):
    """Yield original message identities and metadata across common Discord export shapes."""
    if len(raw) > MAX_IMPORT_BYTES:
        raise ValueError("Export exceeds the 100 MB interactive import limit. Use a smaller authorized export.")
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as e:
        raise ValueError("Not a valid UTF-8 JSON export") from e
    root = data if isinstance(data, list) else data.get("messages", [])
    if not isinstance(root, list):
        raise ValueError("Expected a JSON message list or an object containing messages")
    channel = data.get("channel", {}) if isinstance(data, dict) else {}
    name = (channel.get("name") if isinstance(channel, dict) else None) or filename.rsplit(".", 1)[0]
    digest = hashlib.sha256(raw).hexdigest()
    dataset_id = digest[:20]
    parsed = []
    seen = set()
    for i, m in enumerate(root):
        if not isinstance(m, dict):
            continue
        mid = str(m.get("id") or hashlib.sha256((dataset_id + ":" + str(i)).encode()).hexdigest()[:20])
        if mid in seen:
            continue
        seen.add(mid)
        author = m.get("author") or {}
        if isinstance(author, dict):
            author = author.get("global_name") or author.get("nickname") or author.get("name") or author.get("username") or "unknown"
        ref = m.get("message_reference") or {}
        reply_id = (ref.get("message_id") if isinstance(ref, dict) else None) or m.get("replyTo")
        content = m.get("content") or ""
        if not isinstance(content, str):
            content = str(content)
        attachments = m.get("attachments") or []
        attachment_names = [str(a.get("filename") or a.get("fileName") or "") for a in attachments if isinstance(a, dict)]
        parsed.append({
            "id": mid, "ts": _date(m.get("timestamp") or m.get("createdAt")),
            "author": str(author), "content": content, "reply_to": str(reply_id) if reply_id else None,
            "attachments": attachment_names,
            "channel_id": str(m.get("channel_id") or (channel.get("id") if isinstance(channel, dict) else "") or ""),
            "_original_position": i,
        })
    if root and not parsed:
        raise ValueError("No Discord message objects found. This may be a glossary or stopword list, not a message export.")
    parsed.sort(key=lambda m: (m["ts"], m["_original_position"]))
    for m in parsed:
        m.pop("_original_position")
    return dataset_id, str(name), parsed


SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, imported_at TEXT NOT NULL, message_count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
 dataset_id TEXT NOT NULL, id TEXT NOT NULL, ordinal INTEGER NOT NULL,
 ts TEXT NOT NULL, author TEXT NOT NULL, content TEXT NOT NULL, reply_to TEXT,
 attachments TEXT NOT NULL, channel_id TEXT NOT NULL,
 PRIMARY KEY(dataset_id,id)
);
CREATE INDEX IF NOT EXISTS messages_order ON messages(dataset_id,ordinal);
CREATE INDEX IF NOT EXISTS messages_reply ON messages(dataset_id,reply_to);
CREATE TABLE IF NOT EXISTS terms (
 dataset_id TEXT NOT NULL, term TEXT NOT NULL, df INTEGER NOT NULL,
 kind TEXT NOT NULL, score REAL NOT NULL, PRIMARY KEY(dataset_id,term)
);
CREATE TABLE IF NOT EXISTS term_refs (
 dataset_id TEXT NOT NULL, term TEXT NOT NULL, message_id TEXT NOT NULL,
 PRIMARY KEY(dataset_id,term,message_id)
);
CREATE INDEX IF NOT EXISTS refs_term ON term_refs(dataset_id,term);
CREATE TABLE IF NOT EXISTS notes (
 dataset_id TEXT NOT NULL, target_type TEXT NOT NULL, target_key TEXT NOT NULL,
 note TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(dataset_id,target_type,target_key)
);
CREATE TABLE IF NOT EXISTS seen (
 dataset_id TEXT NOT NULL, target_type TEXT NOT NULL, target_key TEXT NOT NULL,
 seen_at TEXT NOT NULL,
 PRIMARY KEY(dataset_id,target_type,target_key)
);
"""


class Library:
    def __init__(self, path: str | Path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.fts = True
        try:
            self.db.execute("CREATE VIRTUAL TABLE IF NOT EXISTS message_fts USING fts5(dataset_id UNINDEXED,id UNINDEXED,content)")
        except sqlite3.OperationalError:
            self.fts = False
        self.db.commit()

    def close(self):
        self.db.close()

    def datasets(self):
        return [dict(r) for r in self.db.execute("SELECT * FROM datasets ORDER BY imported_at DESC")]

    def import_bytes(self, raw: bytes, filename: str):
        did, name, messages = normalize_export(raw, filename)
        if self.db.execute("SELECT 1 FROM datasets WHERE id=?", (did,)).fetchone():
            return {"id": did, "name": name, "count": len(messages), "cached": True}
        with self.db:
            self.db.executemany(
                "INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?)",
                [(did, m["id"], i, m["ts"], m["author"], m["content"],
                  m["reply_to"], json.dumps(m["attachments"]), m["channel_id"])
                 for i, m in enumerate(messages)]
            )
            if self.fts:
                self.db.executemany(
                    "INSERT INTO message_fts(dataset_id,id,content) VALUES (?,?,?)",
                    [(did, m["id"], m["content"]) for m in messages]
                )
            self._build_index(did, messages)
            self.db.execute("INSERT INTO datasets VALUES (?,?,?,?)",
                            (did, name, datetime.now(timezone.utc).isoformat(), len(messages)))
        return {"id": did, "name": name, "count": len(messages), "cached": False}

    def _build_index(self, did, messages):
        """Index recurring multiword subjects before fallback keywords.

        Rank independent source statements, not repeated copy-pasted templates.
        A heading is a navigation candidate, not a verified semantic category.
        """
        from collections import Counter
        repetitions = Counter(re.sub(r"\s+", " ", m["content"].lower()).strip()
                              for m in messages if m["content"].strip())
        # Exact repeated messages (>=3) often represent copied moderation/help
        # boilerplate. They remain available through direct search, never removed.
        postings, word_docs, kinds = defaultdict(set), defaultdict(set), {}
        seen_content = set()
        for m in messages:
            canonical = re.sub(r"\s+", " ", m["content"].lower()).strip()
            if not canonical or repetitions[canonical] >= 3:
                continue
            if canonical in seen_content:
                continue
            seen_content.add(canonical)
            words = tokens(m["content"])
            valid = {t for t in words if good_token(t) and t not in INDEX_TERM_STOP}
            for word in valid:
                word_docs[word].add(m["id"])
            # Preserve contiguous terms; stopwords are boundaries, not bridges.
            for size in (2, 3):
                for i in range(len(words) - size + 1):
                    chunk = words[i:i + size]
                    if all(good_token(w) and w not in INDEX_STOP and "." not in w
                           for w in chunk):
                        term = " ".join(chunk)
                        postings[term].add(m["id"])
                        kinds[term] = "phrase"
        n = max(1, len(seen_content))
        phrases = []
        for term, ids in postings.items():
            df = len(ids)
            if df < 2:
                continue
            words = term.split()
            association = df / min(len(word_docs[w]) for w in words)
            specificity = sum(math.log((n + 1) / (len(word_docs[w]) + 1))
                              for w in words) / len(words)
            score = (1.1 + math.log1p(df)) * (1 + .75 * association) * (1 + .08 * specificity)
            phrases.append((score, term, ids))
        phrases.sort(key=lambda t: (-t[0], t[1]))
        # Keep a limited secondary term index for standalone technical names.
        singletons = []
        for word, ids in word_docs.items():
            df = len(ids)
            if df < 3 or df > max(5, n // 5):
                continue
            score = math.log1p(df) * math.log1p((n + 1) / (df + 1))
            singletons.append((score, word, ids))
        singletons.sort(key=lambda t: (-t[0], t[1]))

        for i, (score, term, ids) in enumerate(phrases[:85] + singletons[:55]):
            kind = "phrase" if " " in term else "term"
            # Put meaningful subjects before fallback keywords in the UI.
            display_score = (100 + score if kind == "phrase" else score)
            self.db.execute("INSERT INTO terms VALUES (?,?,?,?,?)",
                            (did, term, len(ids), kind, display_score))
            self.db.executemany("INSERT INTO term_refs VALUES (?,?,?)",
                                [(did, term, mid) for mid in ids])

    def index(self, did, limit=120):
        return [dict(r) for r in self.db.execute(
            "SELECT term,df,kind,score FROM terms WHERE dataset_id=? ORDER BY score DESC,term LIMIT ?",
            (did, min(250, max(1, int(limit)))))]
 
    def message(self, did, mid):
        row = self.db.execute("SELECT * FROM messages WHERE dataset_id=? AND id=?", (did,mid)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["attachments"] = json.loads(d["attachments"])
        return d

    def context(self, did, mid, radius=3):
        """Chronological neighbors PLUS explicit reply relationships.

        A nearby message is not assumed to belong to the same conversation.
        Explicit reply links are stronger evidence and can be nonadjacent.
        """
        row = self.db.execute(
            "SELECT ordinal,reply_to FROM messages WHERE dataset_id=? AND id=?",
            (did,mid)).fetchone()
        if not row:
            return []
        i = row["ordinal"]
        rows = self.db.execute(
            "SELECT id,ordinal FROM messages WHERE dataset_id=? AND ordinal BETWEEN ? AND ?",
            (did, max(0, i - radius), i + radius)).fetchall()
        linked = self.db.execute(
            """SELECT id,ordinal FROM messages WHERE dataset_id=? AND
               (id=? OR reply_to=?) ORDER BY ordinal LIMIT 12""",
            (did, row["reply_to"] or "", mid)).fetchall()
        ordered = {r["id"]: r["ordinal"] for r in list(rows) + list(linked)}
        return [self.message(did, msg_id) for msg_id in
                sorted(ordered, key=lambda x: ordered[x])]

    def term_messages(self, did, term, limit=40):
        rows = self.db.execute(
            """SELECT m.id FROM term_refs r JOIN messages m
               ON m.dataset_id=r.dataset_id AND m.id=r.message_id
               WHERE r.dataset_id=? AND r.term=? ORDER BY m.ordinal LIMIT ?""",
            (did,term,min(100,limit))).fetchall()
        return [self.message(did, r["id"]) for r in rows]

    def notes(self, did):
        return [dict(r) for r in self.db.execute(
            """SELECT target_type,target_key,note,updated_at FROM notes
               WHERE dataset_id=? ORDER BY updated_at DESC""", (did,))]

    def save_note(self, did, target_type, target_key, note):
        if not self.db.execute("SELECT 1 FROM datasets WHERE id=?", (did,)).fetchone():
            raise ValueError("Unknown imported dataset.")
        target_type = str(target_type or "").strip()
        target_key = str(target_key or "").strip()
        note = str(note or "").strip()
        if target_type not in {"chapter", "term", "message"}:
            raise ValueError("Unsupported note target.")
        if not target_key or len(target_key) > 300:
            raise ValueError("Invalid note target.")
        if len(note) > 4000:
            raise ValueError("Notes are limited to 4,000 characters.")
        with self.db:
            if note:
                self.db.execute(
                    """INSERT INTO notes(dataset_id,target_type,target_key,note,updated_at)
                       VALUES (?,?,?,?,?)
                       ON CONFLICT(dataset_id,target_type,target_key)
                       DO UPDATE SET note=excluded.note,updated_at=excluded.updated_at""",
                    (did, target_type, target_key, note,
                     datetime.now(timezone.utc).isoformat()))
            else:
                self.db.execute(
                    "DELETE FROM notes WHERE dataset_id=? AND target_type=? AND target_key=?",
                    (did, target_type, target_key))
        return {"target_type": target_type, "target_key": target_key, "note": note}

    def seen(self, did):
        return [dict(r) for r in self.db.execute(
            """SELECT target_type,target_key,seen_at FROM seen
               WHERE dataset_id=? ORDER BY seen_at DESC""", (did,))]

    def mark_seen(self, did, target_type, target_key):
        if not self.db.execute("SELECT 1 FROM datasets WHERE id=?", (did,)).fetchone():
            raise ValueError("Unknown imported dataset.")
        target_type = str(target_type or "").strip()
        target_key = str(target_key or "").strip()
        if target_type not in {"chapter", "term", "message"} or not target_key:
            raise ValueError("Invalid seen target.")
        if len(target_key) > 300:
            raise ValueError("Invalid seen target.")
        now = datetime.now(timezone.utc).isoformat()
        with self.db:
            self.db.execute(
                """INSERT INTO seen(dataset_id,target_type,target_key,seen_at)
                   VALUES (?,?,?,?)
                   ON CONFLICT(dataset_id,target_type,target_key)
                   DO UPDATE SET seen_at=excluded.seen_at""",
                (did, target_type, target_key, now))
        return {"target_type": target_type, "target_key": target_key, "seen_at": now}

    def search(self, did, question, limit=12):
        """Retrieve a broad lexical pool, then prefer multi-term evidence.

        OR-only BM25 often elevates one rare but misleading token.
        No semantic claim or invented evidence is produced by this ranking.
        """
        location_words = {"above", "below", "behind", "before", "after",
                          "under", "between", "without", "not"}
        q = list(dict.fromkeys(t for t in tokens(question)
                               if good_token(t) or t in location_words))[:14]
        if not q:
            q = list(dict.fromkeys(t for t in tokens(question) if len(t) >= 2))[:14]
        if not q:
            return []
        limit = min(30, max(1, int(limit)))
        candidate_ids = []
        if self.fts:
            try:
                expression = " OR ".join('"' + t.replace('"', '') + '"' for t in q)
                rows = self.db.execute(
                    """SELECT id FROM message_fts WHERE dataset_id=? AND message_fts MATCH ?
                    ORDER BY bm25(message_fts) LIMIT ?""",
                    (did, expression, max(100, limit * 12))).fetchall()
                candidate_ids = [r["id"] for r in rows]
            except sqlite3.OperationalError:
                pass
        if not candidate_ids:
            conditions = " OR ".join("LOWER(content) LIKE ?" for _ in q[:8])
            rows = self.db.execute(
                "SELECT id FROM messages WHERE dataset_id=? AND (" + conditions + ") LIMIT ?",
                [did] + ["%" + t + "%" for t in q[:8]] + [max(100, limit * 12)]).fetchall()
            candidate_ids = [r["id"] for r in rows]
        candidates = [self.message(did, mid) for mid in candidate_ids]
        # Preserve independent reports; repeated identical templates add no
        # further conversational evidence to the selected packet.
        ranked, seen = [], set()
        for rank, m in enumerate(candidates):
            content = m["content"]
            canonical = re.sub(r"\s+", " ", content.lower()).strip()
            if canonical in seen:
                continue
            seen.add(canonical)
            subject = set(tokens(content))
            overlap = sum(term in subject for term in q)
            # Consecutive matched tokens are more discriminating than isolated
            # ones; separators in the question are not used as FTS operators.
            phrase = " ".join(tokens(content))
            adjacency = sum((q[i] + " " + q[i + 1]) in phrase
                            for i in range(len(q) - 1))
            ranked.append((-overlap, -adjacency, rank, m))
        ranked.sort(key=lambda p: p[:3])
        return [m for _, _, _, m in ranked[:limit]]
