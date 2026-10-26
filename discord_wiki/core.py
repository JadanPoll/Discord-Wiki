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
TOKEN = re.compile(r"[a-z][a-z0-9_+#.-]{1,39}", re.I)
URL = re.compile(r"https?://\S+", re.I)
STOP = set("""a about above after again against all also am an and any are arent as at back be because been before being below between both but by can cant could couldn did didnt do does doesnt doing don dont down during each few for from further get gets getting got had has hasnt have havent having he her here hers herself him himself his how i id if ill im in into is isnt it its itself just let lets like lol lmao make me more most much my myself no nor not now of off on once only or other our ours ourselves out over own really right same say says said see she should so some such than that thats the their theirs them themselves then there theres these they this those through to too under until up us very via was wasnt we were werent what whats when where which while who whom why will with wont would wouldnt yeah yes you your yours yourself yourselves okay ok oh hmm hey hi thanks thank please people someone anyone something anything thing things stuff time today tomorrow yesterday way ways one two three four first second new old good bad need needs want wants use using used work works working know knows known think thought maybe probably actually basically pretty quite sure issue issues problem problems question questions answer answers look looks looking try trying tried lot lots kind kinds case cases right better best worst like likee yeahh youre theyre ive doesnt wouldnt couldve isnt youre thats didnt doesnt well gonna wanna got gotta yea yep nope yep idk tbh imo iirc afaik btw fr ngl tbh rn btw edit edited reply message discord channel server user users author conversation chat text comment comments content file files https http www com net org gif png jpg jpeg mp4 webp youtube google link links image images video videos""".split())


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
CREATE TABLE IF NOT EXISTS terms (
 dataset_id TEXT NOT NULL, term TEXT NOT NULL, df INTEGER NOT NULL,
 kind TEXT NOT NULL, score REAL NOT NULL, PRIMARY KEY(dataset_id,term)
);
CREATE TABLE IF NOT EXISTS term_refs (
 dataset_id TEXT NOT NULL, term TEXT NOT NULL, message_id TEXT NOT NULL,
 PRIMARY KEY(dataset_id,term,message_id)
);
CREATE INDEX IF NOT EXISTS refs_term ON term_refs(dataset_id,term);
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
        """Book-index-like backreferences. All terms provisional, never source claims."""
        postings = defaultdict(set)
        kinds = {}
        for m in messages:
            original = tokens(m["content"])
            words = [t for t in original if good_token(t)]
            candidates = set(words)
            # Adjacent words must be adjacent in original content, not across removed stopwords.
            candidates |= {original[i] + " " + original[i + 1] for i in range(len(original) - 1)
                           if good_token(original[i]) and good_token(original[i + 1])}
            for term in candidates:
                postings[term].add(m["id"])
                kinds[term] = "phrase" if " " in term else "term"
        n = max(1, len(messages))
        ranked = []
        for term, ids in postings.items():
            df = len(ids)
            if df < 2:
                continue
            # Penalty for mechanically high-frequency words, reward recurring phrases.
            score = math.log1p(df) * math.log1p((n + 1) / (df + 1)) * (1.18 if " " in term else 1)
            ranked.append((score, term, ids))
        ranked.sort(key=lambda x: (-x[0], x[1]))
        for score, term, ids in ranked[:250]:
            self.db.execute("INSERT INTO terms VALUES (?,?,?,?,?)",
                            (did, term, len(ids), kinds[term], score))
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
        row = self.db.execute("SELECT ordinal FROM messages WHERE dataset_id=? AND id=?", (did,mid)).fetchone()
        if not row:
            return []
        i = row["ordinal"]
        rows = self.db.execute(
            "SELECT id FROM messages WHERE dataset_id=? AND ordinal BETWEEN ? AND ? ORDER BY ordinal",
            (did, max(0, i - radius), i + radius)).fetchall()
        return [self.message(did, r["id"]) for r in rows]

    def term_messages(self, did, term, limit=40):
        rows = self.db.execute(
            """SELECT m.id FROM term_refs r JOIN messages m
               ON m.dataset_id=r.dataset_id AND m.id=r.message_id
               WHERE r.dataset_id=? AND r.term=? ORDER BY m.ordinal LIMIT ?""",
            (did,term,min(100,limit))).fetchall()
        return [self.message(did, r["id"]) for r in rows]

    def search(self, did, question, limit=12):
        """Return exact citations only; never substitute a fabricated summary."""
        q = [t for t in tokens(question) if good_token(t)]
        if not q:
            q = [t for t in tokens(question) if len(t) >= 2]
        if not q:
            return []
        limit = min(30, max(1, int(limit)))
        ids = []
        if self.fts:
            try:
                expression = " OR ".join('"' + t.replace('"', '') + '"' for t in dict.fromkeys(q[:12]))
                rows = self.db.execute(
                    """SELECT id FROM message_fts WHERE dataset_id=? AND message_fts MATCH ?
                    ORDER BY bm25(message_fts) LIMIT ?""", (did, expression, limit)).fetchall()
                ids = [r["id"] for r in rows]
            except sqlite3.OperationalError:
                pass
        if not ids:
            conditions = " OR ".join("LOWER(content) LIKE ?" for _ in q[:8])
            rows = self.db.execute(
                "SELECT id FROM messages WHERE dataset_id=? AND (" + conditions + ") LIMIT ?",
                [did] + ["%" + t + "%" for t in q[:8]] + [limit]).fetchall()
            ids = [r["id"] for r in rows]
        return [self.message(did, mid) for mid in ids]
