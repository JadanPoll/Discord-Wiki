# Discord-Wiki

**Turn a Discord community into a browsable personal notebook.**

Discord-Wiki takes a Discord export and turns it into a spatial reference surface: **Key Contents**, a **Glossary**, source-backed browsing, nearby conversation context, questions, sticky notes, and a quiet record of what you have already seen.

![Discord-Wiki — turn a community into a browsable notebook](docs/assets/discord-wiki-community-notebook-showcase.png)

## The 30-second explanation

Pick a community. Then:

1. **Browse Key Contents** to jump into the major regions of the community.
2. **Use the Glossary** when you know roughly what you are looking for.
3. **Ask a question** in ordinary language when you do not.
4. **Open the sources** instead of trusting a detached summary.
5. **Look around the source** to recover the surrounding conversation.
6. **Leave sticky notes** and let the notebook remember what you have already visited.

The interface is deliberately closer to a **book + notebook + research desk** than to Discord search.

![Discord-Wiki — spatial flow from community to contents, questions, sources, and notes](docs/assets/discord-wiki-community-knowledge-journey.png)

The user acts at the intention level — *browse this, find this, ask this, remember this* — while the program handles indexing, retrieval, context expansion, provenance, and optional model use.

## Run it

Requires **Python 3.10+**.

```bash
git clone https://github.com/JadanPoll/Discord-Wiki.git
cd Discord-Wiki
python -m discord_wiki
```

It opens at:

```text
http://127.0.0.1:8767
```

To run without opening the browser automatically:

```bash
python -m discord_wiki --no-browser --port 8767
```

Optional editable install:

```bash
python -m pip install -e .
discord-wiki
```

There is **no Node build, Docker requirement, cloud backend, or API key required** for normal local browsing.

## Import a community

Use **Community → Add Discord export** and choose an authorized Discord JSON export.

The current importer supports flat message arrays and common object-wrapped Discord export shapes up to 100 MB per interactive import.

Discord-Wiki preserves:

- original message IDs
- timestamps and authors
- reply references
- channel identity
- attachment names
- chronological source order

Repeated identical exports are deduplicated by SHA-256.

By default, the local database lives at:

```text
~/.discord_wiki/library.sqlite3
```

Use `--data PATH` to move it.

## What the interface is doing

### Community

The current Discord is treated as a workspace rather than a tiny list item. Switching communities changes the whole notebook.

### Key Contents

A small chapter-like map of the strongest recurring regions in the community.

This is intentionally selective. It is supposed to answer:

> *Where are the major places worth entering?*

### Glossary

A broader lookup surface for specific recurring subjects and phrases.

The glossary is allowed to be messier than Key Contents because a cheap false positive is usually less harmful than making a useful subject invisible.

### Sources

Every useful navigation result points back to original Discord messages.

Search relevance is **not** treated as verification. A Discord participant saying something does not make it true; Discord-Wiki preserves the claim and its provenance.

### Around this source

Selecting a message reveals nearby chronological context and explicit reply information when available.

Message shading is intentionally stronger for denser messages so the eye can spatially scan a conversation instead of reading every line equally.

Chronological neighbors are still only **nearby messages**, not automatically one conversation.

### Sticky notes and seen state

Right-click a chapter, glossary entry, or source message to attach a personal sticky note.

Discord-Wiki separately tracks whether an item has merely been **seen**.

That distinction is intentional:

```text
unseen → encountered → personally noted
```

A note records what mattered to the reader. It does not modify the source or turn a claim into fact.

## Your community as a book

One of the central design questions is:

> **If an excellent editor had to turn this Discord into the most useful possible book or reference, what would the reader need?**

Different communities naturally want different reading shapes:

- troubleshooting-heavy communities → **casebook + handbook**
- project/showcase communities → **atlas + project book**
- exploratory technical communities → **research notebook + sourcebook**
- practical help communities → **methods / problem book**

Discord-Wiki uses cheap structural signals to recommend a **reading projection**, not to declare what the community objectively is.

The important output is the navigable landscape:

```text
community
   ↓
key contents + glossary
   ↓
question or browse
   ↓
source messages
   ↓
surrounding context
   ↓
personal notes / remembered traversal
```

See [The Book Asymptote](docs/BOOK_ASYMPTOTE.md) for the longer design rationale.

## Optional AI

AI is **off by default**.

The static notebook, glossary, source browsing, notes, and retrieval work without any model call.

To enable optional synthesis, configure an OpenAI-compatible HTTPS endpoint:

```powershell
$env:DISCORD_WIKI_LLM_API_KEY = "YOUR_API_KEY"
$env:DISCORD_WIKI_MODEL = "gpt-4o-mini"
python -m discord_wiki
```

Then enable **Use AI to connect the sources** for a question.

Only a bounded set of selected source excerpts is sent to the configured provider. The UI still exposes the source messages so the model is not treated as the provenance layer.

Optional environment variables:

```text
DISCORD_WIKI_LLM_API_KEY
DISCORD_WIKI_MODEL
DISCORD_WIKI_LLM_URL
```

Check your provider's compatibility and privacy policy before enabling it.

## Architecture

```text
discord_wiki/
  core.py        Discord parsing, SQLite, indexing, search, notes, seen state
  book.py        book projection, chapter-like contents, one-off discoveries
  librarian.py   question routing, bounded retrieval, optional model synthesis
  server.py      localhost HTTP/API server
  __main__.py
  web/
    index.html
    app.js
    style.css

tools/
  audit_export.py
  static_feature_audit.py

tests/
  test_core.py
```

The app is intentionally one localhost application: Python serves the same HTML/CSS/JavaScript UI used in the browser.

## Design principles

The implementation is informed by RSM, REM, FKEN, PDFlets, and the Specification Problem Book work, but users should not need to know those frameworks to operate the product.

Internally, the important principles are:

- **Intention before implementation.** The user says what they want; the system owns the machinery.
- **Static before dynamic.** Cheap reusable indexing should do clerical work before expensive semantic reasoning is introduced.
- **Evidence before assertion.** Navigation and retrieval return source material, not automatic truth.
- **Preserve provenance.** Losing or inventing source identity is a catastrophic failure.
- **Optimize actual utility.** Do not add machinery merely because it is clever.
- **Make stopping explicit internally.** Continue investigation only while the next step is worth its cost.
- **Treat UI as landscape + flow.** Central reading/work regions remain visually stable; color and interaction cues help the eye move between them.

The current static vocabulary sanity audit evaluates roughly **98–99%** of an aggressively filtered recurring high-information vocabulary witness across the bundled real-corpus audits while promoting only a much smaller subset into the visible index. That is intentional: *evaluated* does not mean *should be shown*.

## Privacy and scope

Use only Discord exports you have permission to analyze.

Current behavior:

- source messages stay in the local SQLite database
- optional model use sends selected excerpts only when explicitly enabled
- the server binds to localhost by default
- no authentication is provided for internet-facing deployment

Do **not** expose the current localhost server directly to the internet without adding authentication and an appropriate deployment security model.

## Current limits

Discord-Wiki does **not** claim:

- perfect thread reconstruction
- verified technical truth from community messages
- universal semantic clustering
- attachment-content ingestion
- automated expertise profiling
- production-ready remote multi-user hosting
- complete recovery of every conversation episode

Sparse source context can genuinely be sparse. The system deliberately avoids filling a pane with weakly related material merely to make it look complete.

## Tests and real-corpus audits

Run:

```bash
python -m unittest discover -s tests -v
```

The repository also runs real-corpus audits over Minecraft redstone, VR hardware, and Raspberry Pi showcase exports to inspect:

- index quality
- book projection
- question → evidence retrieval
- static → dynamic retrieval behavior
- vocabulary coverage
- provenance preservation

See [Real Corpus Audit — 2026-10-26](docs/REAL_CORPUS_AUDIT_2026-10-26.md).

Tests are useful for regressions; the real criterion is whether the notebook helps a person reach useful source-backed understanding with less friction.
