# Discord-Wiki — RSM Investigation Workspace

**Status: experimental localhost reboot.** This is one application, not competing desktop, Flask and React products. Python serves the **same web UI** in the browser or as a localhost desktop-style app. No Node install, background cloud service, Docker, API key, or build step is required for static use.

> Primary problem: Given a messy record of human conversation and an imperfect question, can an investigator economically reconstruct the evidence, explore consequential alternatives, and stop with a defensible result? The wiki is a useful projection of that work, not the target in itself.

## Run

Requires Python 3.10 or newer.

    git clone https://github.com/JadanPoll/Discord-Wiki.git
    cd Discord-Wiki
    python -m discord_wiki

The app opens at **http://127.0.0.1:8767**. To run without automatically opening the browser:

    python -m discord_wiki --no-browser --port 8767

Optional installation for the \`discord-wiki\` command:

    python -m pip install -e .
    discord-wiki

**Desktop = localhost website.** There is one HTML/CSS/JavaScript front end under \`discord_wiki/web/\`. The server is the shared shell. The personal data database defaults to \`~/.discord_wiki/library.sqlite3\` and can be moved with \`--data PATH\`. It binds to localhost only; remote multi-user hosting needs authentication before it is safe.

## What works now

- Import authorized Discord JSON exports (flat message arrays and two common object-wrapped shapes) up to 100 MB each. They are stored in a local SQLite database; repeated identical files are deduplicated by SHA-256.
- Preserve message identity, timestamp, author, reply reference, channel identity and attachment **names**; keep chronological source context recoverable.
- Compile a **book-oriented reading surface**: a recommended book/reference projection, a small chapter-like contents page, a deliberately messy but useful glossary, and exact source backreferences. The projection is an interface recommendation, not a claim about the community.
- Search with SQLite FTS5 (or a slower substring fallback). Relevance is a way to select evidence, not a truth or expertise claim.
- Open a question-conditioned **RSM investigation certificate**: original goal, scope, routed task, selected message evidence, coverage boundary, next question and stopping rule.
- Save compact investigation histories locally; explicitly pick a previous investigation when continuing its parent goal.
- Optionally request LLM synthesis for **selected excerpts only**; this is off by default and never silently calls a model.

### Optional model synthesis

Configure one API key in the **local machine's environment** before launching. Never enter tokens into Discord, an imported dataset, or a shared chat:

    # PowerShell example
    $env:DISCORD_WIKI_LLM_API_KEY = "YOUR_API_KEY"
    $env:DISCORD_WIKI_MODEL = "gpt-4o-mini"
    python -m discord_wiki

This uses an OpenAI-compatible HTTPS chat-completions API by default. \`DISCORD_WIKI_LLM_URL\` changes the endpoint and \`DISCORD_WIKI_MODEL\` selects the model. Check your provider's compatibility and privacy policy first. Tick the model checkbox per question to send up to twelve bounded source excerpts. The static index and evidence retrieval use no model calls. If no key is configured or a request fails, the UI reports the limitation without inventing a synthesis.

## The book asymptote

The UI is designed by asking: **if an excellent editor had to turn this Discord into
the most useful possible technical book/reference, what would the reader need in
order to act on an intention immediately?**

Different corpora can want different reading topologies. Troubleshooting-heavy
channels may look like a **casebook + handbook**; showcase channels like an
**atlas + project book**; exploratory technical communities like **research notes
+ sourcebook**. The app infers only a cheap provisional projection from corpus
structure, then exposes:

1. a cover-like reading promise,
2. a small contents page,
3. a messy but useful glossary,
4. the Librarian for question-conditioned investigation,
5. one-click descent to original source messages.

This is intentionally not a perfect taxonomy. In REM terms, false-positive
glossary entries are usually cheap while invisible valuable material is expensive.
The system should spend complexity only when a demonstrated failure materially
blocks learning or investigation.

See [The Book Asymptote](docs/BOOK_ASYMPTOTE.md) for the design contract.

## Why this architecture (RSM / REM / FKEN)

The PDFlets \`Critical_Note.md\` sets the static intelligence target: an *admissible, book-like index/glossary*. It must be consistently helpful as a navigational surface, not mechanically exhaustive or semantically omniscient. Discord-Wiki's first obligation is therefore a **source-grounded index of conversation**.

- **RSM:** question and parent purpose before tool selection; evidence versus hypothesis versus conclusion; unresolved uncertainty and justified stopping.
- **REM:** static, inexpensive evidence infrastructure before dynamic or model-heavy escalation. Each component must justify cost and friction.
- **FKEN:** lazy useful navigation and cross-topic connections; a similarity edge is **not automatically** a prerequisite or taxonomy parent.
- **Librarian:** a bounded investigation packet navigates the static index and can selectively request semantic interpretation. A model is not a substitute for source provenance.

This reboot deliberately avoids importing the old ranking and hierarchy implementations merely because they exist. Those implementations, their evaluation artifacts, and the original React/Flask website remain accessible on the repository's **pre-reboot main history**. Nothing has been force-deleted from Git history.

### Working tree

    discord_wiki/
      core.py             # Discord parsing, SQLite, book-style index, source search
      librarian.py        # RSM question routes, investigation history, optional model
      server.py           # localhost-only HTTP/API and desktop-style launcher
      __main__.py
      web/
        index.html        # the one UI for browser and localhost desktop
        style.css
        app.js
    tests/
      test_core.py
    pyproject.toml

## What is not yet established

This is **not** a validated replacement for the April 2026 mutual-top-k/context-chain pipeline, whose recorded eleven-channel experiments and 9.2M-row benchmarks belong to historical work. The new MVP does not claim large-file streaming, high-quality conversation clustering, accurate automated expertise profiles, attachment retrieval, full-thread reconstruction, universal glossary admissibility, autonomous RSM reasoning, or production-ready remote deployment.

In particular, chronological neighbors are **context**, not automatically a single conversation; references to replies are preserved, but the interface does not invent thread membership. The first question is whether the index and Librarian improve real **question-answering**, not how many terms or pages they produce.

## Next falsifiable experiments

1. **Index admissibility:** On Minecraft redstone, CEMU hardware, Raspberry Pi showcases and VR hardware, inspect independent random and difficult index entries. Are the labels recognizable, distinct and useful? What percentage of navigational selections recover the intended discussion?
2. **Retrieval comparison:** Hold 20–40 answerable questions and their source-message evidence fixed. Compare basic lexical retrieval, the old mutual-top-k graph (when ported), and the Librarian. Report source precision, recall, quote integrity, time and tokens; do not use hand-corrected keyword lists as proof of conversational coherence.
3. **RSM advancement:** For question types (investigate, verify, diagnose, compare, discover), measure whether a user can select a better next step with fewer examined messages and without false claims.
4. **Failure taxonomy:** Track wrongly merged contexts, incomplete replies, disputed claims treated as truth, misleading index labels, query reformulations that drop the goal, model citations to absent evidence and unnecessary clarifications.
5. **Stop:** Continue only while a fix materially improves an actual investigation; an elaborate hierarchy that does not change a user's decision does not earn its upkeep.

The planned Discord Tampermonkey navigator is another source/navigation surface, not another reasoning engine: it should use the same source-message identities and investigation contract when implemented.

## Tests

    python -m unittest discover -s tests -v

The tests cover import shapes, citation identity, deduplication, source context, glossary backreferences, no-match behavior and investigation continuity. They do **not** substitute for the real-corpus evaluations above.

## Privacy

Use only Discord exports you have permission to analyze. Source messages live locally; the optional model action transmits selected message text to the configured provider. The app does not silently upload data. Do not publish the SQLite database or serve this unauthenticated localhost MVP to the internet.
