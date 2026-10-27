"""Thin ASGI adapter for Vercel.

The localhost server remains the primary persistent/private runtime. Vercel uses
/tmp, so imports/notes are intentionally ephemeral and suitable for public demos.
"""
from __future__ import annotations

import json
import mimetypes
from pathlib import Path
import threading
from urllib.parse import parse_qs, unquote

from discord_wiki.core import Library, MAX_IMPORT_BYTES, ImportMappingRequired
from discord_wiki import book
from discord_wiki.librarian import Librarian

WEB = Path(__file__).parent / "discord_wiki" / "web"
DB = Path("/tmp/discord-wiki-vercel.sqlite3")
_library = Library(DB)
_librarian = Librarian(_library)
_lock = threading.RLock()

HEADERS = [
    (b"cache-control", b"no-store"),
    (b"x-content-type-options", b"nosniff"),
    (b"content-security-policy",
     b"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'"),
]


def _json(obj, status=200):
    raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    return status, b"application/json; charset=utf-8", raw


def _query(scope):
    raw = scope.get("query_string", b"").decode("utf-8", "replace")
    q = parse_qs(raw)
    return lambda k: q.get(k, [""])[0]


async def _body(receive):
    chunks = []
    total = 0
    while True:
        event = await receive()
        if event["type"] != "http.request":
            continue
        chunk = event.get("body", b"")
        total += len(chunk)
        if total > MAX_IMPORT_BYTES:
            raise ValueError("Request exceeds the 100 MB limit.")
        chunks.append(chunk)
        if not event.get("more_body"):
            return b"".join(chunks)


def _get(path, one):
    with _lock:
        if path == "/api/datasets":
            return _json({"datasets": _library.datasets()})
        if path == "/api/index":
            return _json({"topics": _library.index(one("dataset"))})
        if path == "/api/book":
            return _json(book.view(_library, one("dataset")))
        if path == "/api/chapter":
            return _json({"messages": book.chapter_messages(
                _library, one("dataset"), one("key"))})
        if path == "/api/term":
            return _json({"messages": _library.term_messages(
                one("dataset"), one("term"))})
        if path == "/api/context":
            radius = min(25, max(1, int(one("radius") or "3")))
            return _json({"messages": _library.context(
                one("dataset"), one("message"), radius)})
        if path == "/api/history":
            return _json({"history": _librarian.history(one("dataset"))})
        if path == "/api/notes":
            return _json({"notes": _library.notes(one("dataset"))})
        if path == "/api/seen":
            return _json({"seen": _library.seen(one("dataset"))})

    filename = "index.html" if path in ("/", "/index.html") else path.removeprefix("/")
    if filename not in ("index.html", "style.css", "app.js"):
        return _json({"error": "Not found"}, 404)
    raw = (WEB / filename).read_bytes()
    kind = (mimetypes.guess_type(filename)[0] or "application/octet-stream") + "; charset=utf-8"
    return 200, kind.encode(), raw


def _post(path, raw, headers):
    with _lock:
        if path == "/api/import":
            name = unquote(headers.get("x-filename", "archive"))
            mapping_header = headers.get("x-import-mapping")
            mapping = json.loads(unquote(mapping_header)) if mapping_header else None
            try:
                return _json(_library.import_bytes(raw, Path(name).name, mapping))
            except ImportMappingRequired as exc:
                return _json({
                    "mapping_required": True,
                    "message": str(exc),
                    "inspection": exc.inspection,
                }, 422)

        payload = json.loads(raw or b"{}")
        if not isinstance(payload, dict):
            raise ValueError("Expected a JSON object.")

        if path == "/api/investigate":
            return _json(_librarian.investigate(
                payload.get("dataset", ""), payload.get("question", ""),
                payload.get("parent_id"), payload.get("reason") is True))
        if path == "/api/note":
            return _json(_library.save_note(
                payload.get("dataset", ""), payload.get("target_type", ""),
                payload.get("target_key", ""), payload.get("note", "")))
        if path == "/api/seen":
            return _json(_library.mark_seen(
                payload.get("dataset", ""), payload.get("target_type", ""),
                payload.get("target_key", "")))
    return _json({"error": "Not found"}, 404)


async def app(scope, receive, send):
    if scope["type"] != "http":
        return

    path = scope.get("path", "/")
    method = scope.get("method", "GET").upper()
    headers = {
        k.decode("latin-1").lower(): v.decode("latin-1")
        for k, v in scope.get("headers", [])
    }

    try:
        if method == "GET":
            status, kind, raw = _get(path, _query(scope))
        elif method == "POST":
            ctype = headers.get("content-type", "").split(";")[0]
            if ctype != "application/json":
                status, kind, raw = _json({"error": "Expected application/json."}, 415)
            else:
                raw_body = await _body(receive)
                if not raw_body:
                    status, kind, raw = _json({"error": "Request is empty."}, 413)
                else:
                    status, kind, raw = _post(path, raw_body, headers)
        else:
            status, kind, raw = _json({"error": "Method not allowed"}, 405)
    except (ValueError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        status, kind, raw = _json({"error": str(exc)}, 400)
    except Exception:
        status, kind, raw = _json({"error": "Internal error."}, 500)

    response_headers = [(b"content-type", kind), (b"content-length", str(len(raw)).encode())] + HEADERS
    await send({"type": "http.response.start", "status": status, "headers": response_headers})
    await send({"type": "http.response.body", "body": raw})
