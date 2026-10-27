"""Self-healing archive ingestion.

The durable contract is intentionally tiny:
1. records/messages can be separated and ordered;
2. records contain some usable payload, normally text.

Everything else (author, timestamp, original ID, reply, attachments, channel) is
optional enrichment. Ambiguous archives return an inspection that the UI can map.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MAX_IMPORT_BYTES = 100 * 1024 * 1024
VALUE_PATH = ["$value"]

SEMANTICS = ("content", "author", "timestamp", "id", "reply_to", "attachments", "channel_id")
ALIASES = {
    "id": ("id", "message_id", "messageid", "message.id", "msg_id", "snowflake"),
    "timestamp": (
        "timestamp", "created_at", "createdat", "sent_at", "sentat", "datetime",
        "date", "time",
    ),
    "author": (
        "author.username", "author.global_name", "author.nickname", "author.name",
        "user.username", "user.name", "sender.username", "sender.name",
        "username", "author", "sender", "user",
    ),
    "content": (
        "content", "message_content", "messagecontent", "text", "body", "message",
        "message.text", "payload.content", "comment",
    ),
    "reply_to": (
        "message_reference.message_id", "message_reference.id", "reply_to",
        "replyto", "reply_to_id", "referenced_message.id", "reference.message_id",
        "parent_id",
    ),
    "attachments": ("attachments", "files", "media", "uploads"),
    "channel_id": ("channel_id", "channelid", "channel.id", "room_id", "room.id"),
}
CONTAINER_HINTS = {
    "messages": 4.0, "message": 3.0, "items": 1.5, "records": 1.5,
    "events": .75, "data": .25, "results": .25,
}


class ImportMappingRequired(ValueError):
    def __init__(self, inspection: dict):
        super().__init__(
            "This archive is readable, but Discord-Wiki needs help identifying the messages."
        )
        self.inspection = inspection


def _date(value: Any) -> str:
    if value in (None, ""):
        return ""
    try:
        if isinstance(value, (int, float)):
            number = float(value)
            dt = datetime.fromtimestamp(number / 1000 if abs(number) > 1e11 else number,
                                        tz=timezone.utc)
        else:
            text = str(value).strip()
            if re.fullmatch(r"-?\d+(?:\.\d+)?", text):
                number = float(text)
                dt = datetime.fromtimestamp(number / 1000 if abs(number) > 1e11 else number,
                                            tz=timezone.utc)
            else:
                dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, OSError, OverflowError, TypeError):
        return str(value)


def parse_archive(raw: bytes, filename: str) -> tuple[Any, str]:
    if len(raw) > MAX_IMPORT_BYTES:
        raise ValueError("Archive exceeds the 100 MB interactive import limit.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(
            "Archive must be UTF-8 text. JSON, JSONL/NDJSON, CSV, TSV, and line-based text are supported."
        ) from exc

    try:
        return json.loads(text), "json"
    except json.JSONDecodeError:
        pass

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if lines:
        rows = []
        try:
            for line in lines:
                item = json.loads(line)
                if not isinstance(item, dict):
                    raise ValueError
                rows.append(item)
            if rows:
                return rows, "jsonl"
        except (json.JSONDecodeError, ValueError):
            pass

    try:
        sample = text[:8192]
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        rows = [dict(row) for row in reader]
        if rows and reader.fieldnames and len(reader.fieldnames) >= 2:
            return rows, "csv"
    except csv.Error:
        pass

    suffix = Path(filename).suffix.lower()
    if suffix in {".csv", ".tsv"}:
        try:
            reader = csv.DictReader(
                io.StringIO(text), delimiter="\t" if suffix == ".tsv" else ",")
            rows = [dict(row) for row in reader]
            if rows and reader.fieldnames:
                return rows, "csv"
        except csv.Error:
            pass

    # Plain text is inherently ambiguous, but a human can intentionally declare
    # that one non-empty line is one record. Never silently make that assumption.
    if len(lines) >= 2:
        return lines, "lines"
    raise ValueError("Could not find a record-oriented JSON, JSONL, CSV/TSV, or text archive.")


def _get(value: Any, path: list[str] | tuple[str, ...] | None) -> Any:
    if path is None:
        return None
    if len(path) == 0:
        return value
    if list(path) == VALUE_PATH:
        return value
    cur = value
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def _flatten(record: dict, prefix: tuple[str, ...] = (), depth: int = 0):
    if depth > 3:
        return
    for key, value in record.items():
        path = prefix + (str(key),)
        yield path, value
        if isinstance(value, dict) and depth < 3:
            yield from _flatten(value, path, depth + 1)


def _norm_path(path: tuple[str, ...] | list[str]) -> str:
    return ".".join(path).lower().replace("-", "_").replace(" ", "_")


def _path_name_score(semantic: str, path: tuple[str, ...]) -> float:
    name = _norm_path(path)
    aliases = ALIASES[semantic]
    if name in aliases:
        return 8.0 - aliases.index(name) * .15
    leaf = name.split(".")[-1]
    leaf_aliases = [a.split(".")[-1] for a in aliases]
    if leaf in leaf_aliases:
        return 4.0
    return 0.0


def _value_fit(semantic: str, values: list[Any]) -> float:
    present = [v for v in values if v not in (None, "")]
    if not present:
        return 0.0
    if semantic == "content":
        strings = [v for v in present if isinstance(v, str)]
        if not strings:
            return 0.0
        meaningful = sum(bool(v.strip()) for v in strings) / len(strings)
        avg = sum(len(v) for v in strings) / len(strings)
        return meaningful * (1.0 + min(2.0, avg / 60))
    if semantic == "timestamp":
        success = sum(_date(v) != str(v) or "T" in _date(v) for v in present)
        return 2.0 * success / len(present)
    if semantic == "attachments":
        structured = sum(isinstance(v, (list, dict)) for v in present)
        return 1.5 * structured / len(present)
    if semantic == "id":
        unique = len({str(v) for v in present}) / len(present)
        return 1.2 * unique
    if semantic in ("author", "reply_to", "channel_id"):
        scalar = sum(isinstance(v, (str, int, float)) for v in present)
        return scalar / len(present)
    return 0.0


def _candidate_fields(records: list[Any]) -> tuple[list[dict], dict, dict]:
    sample = records[:50]
    if sample and all(not isinstance(x, dict) for x in sample):
        fields = [{
            "path": VALUE_PATH, "label": "Each item", "samples": [
                str(v)[:180] for v in sample[:3] if v not in (None, "")
            ]
        }]
        # We can suggest "each item is text", but deliberately give it zero
        # confidence so a list of glossary words is never silently imported as chat.
        return fields, {"content": VALUE_PATH}, {"content": 0.0}

    paths: dict[tuple[str, ...], list[Any]] = {}
    for record in sample:
        if not isinstance(record, dict):
            continue
        for path, _ in _flatten(record):
            paths.setdefault(path, []).append(_get(record, path))

    fields = []
    for path, values in sorted(paths.items(), key=lambda item: _norm_path(item[0])):
        samples = [str(v)[:180] for v in values if v not in (None, "")][:3]
        fields.append({"path": list(path), "label": ".".join(path), "samples": samples})

    suggested: dict[str, list[str]] = {}
    confidence: dict[str, float] = {}
    for semantic in SEMANTICS:
        scored = []
        for path, values in paths.items():
            name_score = _path_name_score(semantic, path)
            fit = _value_fit(semantic, values)
            # Message text has enough intrinsic shape to help identify an unknown
            # field. But a key merely named "message" is not enough if its values
            # are objects/numbers rather than text.
            if semantic == "content" and fit == 0:
                continue
            # Optional metadata needs name evidence; missing is safer than guessed.
            if semantic != "content" and name_score == 0:
                continue
            score = name_score + fit
            if score:
                scored.append((score, path))
        scored.sort(key=lambda item: (-item[0], _norm_path(item[1])))
        if scored:
            suggested[semantic] = list(scored[0][1])
            gap = scored[0][0] - (scored[1][0] if len(scored) > 1 else 0)
            confidence[semantic] = round(min(1.0, (scored[0][0] + gap) / 10), 3)
    return fields, suggested, confidence


def _collections(value: Any, path: tuple[str, ...] = (), depth: int = 0):
    if depth > 3:
        return
    if isinstance(value, list) and value:
        yield path, value
    if isinstance(value, dict):
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                yield from _collections(child, path + (str(key),), depth + 1)


def inspect_archive(raw: bytes, filename: str) -> dict:
    data, fmt = parse_archive(raw, filename)
    candidates = []
    for path, records in _collections(data):
        if not records:
            continue
        objectish = sum(isinstance(r, dict) for r in records[:50])
        scalarish = sum(not isinstance(r, (dict, list)) for r in records[:50])
        if not objectish and not scalarish:
            continue
        fields, suggested, confidence = _candidate_fields(records)
        leaf = path[-1].lower() if path else ""
        container_score = CONTAINER_HINTS.get(leaf, 0.0)
        content_conf = confidence.get("content", 0.0)
        score = container_score + content_conf * 6 + min(2.0, len(records) / 100)
        preview = []
        for record in records[:3]:
            if isinstance(record, dict):
                preview.append({
                    ".".join(p): str(v)[:180]
                    for p, v in _flatten(record)
                    if not isinstance(v, (dict, list)) and v not in (None, "")
                })
            else:
                preview.append({"$value": str(record)[:180]})
        candidates.append({
            "record_path": list(path),
            "label": ".".join(path) if path else "Top level",
            "count": len(records),
            "record_kind": "object" if objectish else "value",
            "fields": fields,
            "suggested": suggested,
            "confidence": confidence,
            "score": round(score, 3),
            "preview": preview,
        })
    candidates.sort(key=lambda c: (-c["score"], -c["count"], c["label"]))
    if not candidates:
        raise ValueError("No record list was found in this archive.")
    return {
        "filename": Path(filename).name,
        "format": fmt,
        "minimum": "Message text is enough. Author, time, IDs, replies, attachments, and channel are optional.",
        "candidates": candidates[:12],
        "recommended": 0,
    }


def _attachment_names(value: Any) -> list[str]:
    if value in (None, ""):
        return []
    if isinstance(value, list):
        out = []
        for item in value:
            if isinstance(item, dict):
                name = (item.get("filename") or item.get("fileName") or item.get("name")
                        or item.get("url") or item.get("id"))
                if name:
                    out.append(str(name))
            elif item not in (None, ""):
                out.append(str(item))
        return out
    if isinstance(value, dict):
        name = value.get("filename") or value.get("fileName") or value.get("name") or value.get("url")
        return [str(name)] if name else []
    return [str(value)]


def _author(value: Any) -> str:
    if value in (None, ""):
        return "unknown"
    if isinstance(value, dict):
        for key in ("global_name", "nickname", "name", "username", "display_name", "id"):
            if value.get(key) not in (None, ""):
                return str(value[key])
        return "unknown"
    return str(value)


def _mapping_key(mapping: dict | None) -> str:
    if not mapping:
        return ""
    clean = {
        "record_path": mapping.get("record_path", []),
        "fields": {k: v for k, v in sorted((mapping.get("fields") or {}).items()) if v},
    }
    return json.dumps(clean, sort_keys=True, separators=(",", ":"))


def normalize_archive(raw: bytes, filename: str, mapping: dict | None = None):
    data, fmt = parse_archive(raw, filename)
    inspection = inspect_archive(raw, filename)

    if mapping is None:
        candidate = inspection["candidates"][inspection["recommended"]]
        content_path = candidate["suggested"].get("content")
        content_conf = candidate["confidence"].get("content", 0.0)
        attachment_path = candidate["suggested"].get("attachments")
        attachment_conf = candidate["confidence"].get("attachments", 0.0)
        # Auto-heal only when "what is a message?" and at least one usable payload
        # are strong. Missing author/time/IDs are not ambiguity.
        payload_is_clear = (
            (content_path and content_conf >= .65) or
            (attachment_path and attachment_conf >= .65)
        )
        if candidate["record_kind"] != "object" or not payload_is_clear:
            raise ImportMappingRequired(inspection)
        mapping = {
            "record_path": candidate["record_path"],
            "fields": candidate["suggested"],
            "_automatic": True,
        }

    record_path = mapping.get("record_path", [])
    fields = mapping.get("fields") or {}
    records = _get(data, record_path)
    if not isinstance(records, list):
        raise ValueError("The selected message list no longer matches this file.")

    content_path = fields.get("content")
    attachment_path = fields.get("attachments")
    if not content_path and not attachment_path:
        raise ValueError("Choose message text or attachments. Everything else is optional.")

    raw_digest = hashlib.sha256(raw).hexdigest()
    # Preserve historical identity for confidently automatic imports. A manual
    # interpretation is part of identity because the same bytes can mean different things.
    if mapping.get("_automatic"):
        dataset_id = raw_digest[:20]
    else:
        identity = raw_digest + "\n" + _mapping_key(mapping)
        dataset_id = hashlib.sha256(identity.encode()).hexdigest()[:20]

    parsed = []
    seen = set()
    for i, record in enumerate(records):
        content = _get(record, content_path) if content_path else ""
        if content in (None, ""):
            content = ""
        elif not isinstance(content, str):
            content = json.dumps(content, ensure_ascii=False) if isinstance(content, (dict, list)) else str(content)

        attachments = _attachment_names(_get(record, attachment_path)) if attachment_path else []
        original_id = _get(record, fields.get("id"))
        mid = str(original_id) if original_id not in (None, "") else hashlib.sha256(
            (dataset_id + ":" + str(i)).encode()).hexdigest()[:20]
        if mid in seen:
            # Duplicate source IDs should not erase records; stabilize with position.
            mid = hashlib.sha256((dataset_id + ":" + mid + ":" + str(i)).encode()).hexdigest()[:20]
        seen.add(mid)

        reply = _get(record, fields.get("reply_to"))
        channel = _get(record, fields.get("channel_id"))
        parsed.append({
            "id": mid,
            "ts": _date(_get(record, fields.get("timestamp"))),
            "author": _author(_get(record, fields.get("author"))),
            "content": content,
            "reply_to": str(reply) if reply not in (None, "") else None,
            "attachments": attachments,
            "channel_id": str(channel) if channel not in (None, "") else "",
            "_original_position": i,
        })

    if not parsed:
        raise ValueError("The selected message list is empty.")
    if not any(m["content"].strip() or m["attachments"] for m in parsed):
        raise ValueError("The selected mapping produced no readable message text or attachments.")

    # Source order is the fallback chronology. Only reorder when every record has
    # an actual timestamp; partial timestamps must not scramble stripped archives.
    if all(m["ts"] for m in parsed):
        parsed.sort(key=lambda m: (m["ts"], m["_original_position"]))
    else:
        parsed.sort(key=lambda m: m["_original_position"])
    for item in parsed:
        item.pop("_original_position")

    name = Path(filename).stem
    if isinstance(data, dict):
        channel = data.get("channel")
        if isinstance(channel, dict) and channel.get("name"):
            name = str(channel["name"])

    return dataset_id, name, parsed, {
        "format": fmt,
        "mapping": mapping,
        "missing": [s for s in SEMANTICS if not fields.get(s)],
    }
