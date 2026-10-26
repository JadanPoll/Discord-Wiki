# The Book Asymptote

Discord-Wiki is not trying to make Discord look tidy. The asymptotic design question is:

> If an excellent editor had to turn this Discord into the most useful possible
> textbook, handbook, casebook, atlas, sourcebook, or hybrid reference, what
> structure would let a reader act on an intention with the fewest unnecessary
> reasoning and navigation steps?

That question is a design instrument for the whole system: backend algorithms,
the Librarian, and the user interface.

## Why "book" is a useful asymptote

A good technical book hides enormous editorial machinery. The reader is not
required to understand clustering, retrieval, ranking, provenance databases, or
conversation reconstruction. The reader sees useful affordances:

- a title and a clear promise,
- a table of contents that exposes the territory,
- chapters that group material at a useful scale,
- an intentionally messy index/glossary that makes specific things findable,
- cross-references,
- examples/cases/projects,
- sources and citations,
- enough exposition to know where to go next.

Discord-Wiki should compile the messy conversational substrate into analogous
affordances while preserving the original messages underneath.

The book is not the truth. It is a projection optimized for use.

## Discords do not all want the same book

The learning-resource taxonomy suggests separating the nominal genre from its
information topology and intended cognitive action. A Discord may therefore be
best rendered as a hybrid.

Examples:

- troubleshooting-heavy technical Discord -> **casebook + handbook**
  - concrete episodes, diagnoses, competing fixes, recurring lookup subjects
- project showcase -> **atlas + project book**
  - artifacts first, then build notes, implementation details, related examples
- standards/API community -> **handbook + sourcebook**
  - stable lookup entries backed by primary discussions and external references
- exploratory R&D channel -> **research notebook + proceedings/sourcebook**
  - hypotheses, experiments, updates, unresolved questions, primary evidence
- methods/help channel -> **cookbook + problem book**
  - "when X, try Y" procedures plus failures and boundary cases

The system should recommend a reading architecture from cheap corpus signals.
It must not claim that this classification establishes the community's purpose,
expertise, or truth.

## User-facing hierarchy

The default reading surface should feel like a book before it feels like an
analysis console:

1. **Cover / reading promise**
   - "This corpus is most useful as: Handbook + Casebook"
   - one sentence explaining what that means
2. **Contents**
   - broad, chapter-like subject regions
   - deliberately small enough to scan
3. **Messy but useful glossary**
   - many more specific recurring terms and phrases
   - overlap and imperfect labels are acceptable
4. **Ask the Librarian**
   - natural-language intention
   - the user should not need to choose retrieval algorithms
5. **Source descent**
   - original message, replies, neighboring context, attachments, timestamps
6. **Investigation state when needed**
   - competing explanations, consequential uncertainty, next discriminating
     observation, stopping condition

The interface should reveal machinery only when it helps the user's decision.

## If the source is already a book

The same flow should generalize naturally to textbooks and reference books, but the
machine should not rediscover structure the author already supplied. If a source has
a table of contents and glossary/index, ingest those as high-quality static priors:

- **table of contents -> authored landscape / chapter graph**
- **glossary or back-of-book index -> authored lookup surface**
- **pages/sections -> source evidence**
- **reader notes and seen state -> personal traversal layer**
- **Librarian -> question-conditioned movement across the authored structure**

This removes the requirement to read linearly without pretending sequence is
useless. A reader can move spatially by concept, chapter, case, or question, then
descend into the original passage when needed. The existing book structure should
normally outrank machine-inferred chapters unless actual use exposes a concrete
navigation failure.

This also makes LLM use more admissible: the model receives a bounded, authored
structural packet plus selected passages instead of an undifferentiated entire book.
The model's role becomes choosing and connecting relevant regions, not inventing the
book's organization from scratch.

## Reader memory: margins, sticky notes, and coverage

Books become substantially more useful when the reader can leave a personal layer
over the editorial one. Discord-Wiki therefore treats notes as a separate local
memory surface:

- right-click a chapter, glossary entry, or source message to attach a note,
- noted objects receive a small yellow marker and retain the note across sessions,
- the note records what mattered *to the reader*, not what the source establishes,
- notes never rewrite or upgrade source evidence,
- notes are not silently sent to an external model.

This creates a future bridge to FKEN-style encounter/coverage tracking. A sticky
note is a strong signal that an object was encountered and personally relevant,
but it should not be confused with automatic "seen" state or with understanding.
Those can remain separate certificates.

## REM: static -> dynamo-static -> meta-dynamo-static

### Static compilation

Cheap machinery should compile the clerical substrate:

- exact source identity and provenance,
- chronological order and explicit reply edges,
- phrase/term index,
- repetitive-template suppression,
- rare artifact/project anchors,
- attachments and URLs,
- broad chapter candidates,
- lightweight structural signals used to recommend a book projection.

Static outputs are observations and navigation aids, not semantic conclusions.

### Dynamo-static investigation

The Librarian starts from the user's intention and a bounded static packet.

A cheap first retrieval establishes priors. Partial evidence can then change
which already-compiled signals deserve attention. For example, a question about
eye tracking may first retrieve a prototype discussion; that discussion may
introduce "pupil swim" or "fresnel lens", which becomes a justified local search
expansion.

The dynamic rule is not "adapt until something matches." It is:

> Did the new clue explain or retrieve something that the original static pass
> could not, at acceptable cost and noise?

This keeps adaptation falsifiable.

### Meta-dynamo-static control

The system should also recognize when the *kind of investigation* is failing.

Examples:

- chronological expansion keeps mixing conversations -> prefer reply edges,
  author/project continuity, or later follow-ups;
- keyword retrieval repeatedly finds questions but not answers -> use
  episode-level answer recovery;
- recurring-term index misses showcase projects -> add one-off artifact anchors;
- dynamic expansion increases noise without new useful evidence -> retreat to the
  static packet;
- available messages cannot distinguish hypotheses -> report unresolved rather
  than compounding inference.

This is the failure taxonomy acting on the reasoning procedure itself.

## Hypothesis discipline

The Librarian should spend semantic intelligence on decisions machines cannot
cheaply precompile.

For an explanatory question:

1. form a small set of plausible competing hypotheses,
2. record why each is currently plausible,
3. identify which existing evidence supports or weakens each,
4. choose the cheapest observation likely to discriminate them,
5. update rather than merely accumulate,
6. stop when the user's intended decision/understanding is supported enough, or
   when further evidence is not worth its cost.

A hypothesis that merely permits more retrieved noise has not earned its place.
Dynamic machinery should outperform the simpler static explanation.

## Static-feature sanity audit

The runtime should not keep growing dynamic machinery merely because more clever
machinery can be imagined. The repository includes an internal audit that creates
an aggressively filtered, recurring high-information vocabulary witness and asks
how much of it is accounted for by several cheap feature families.

This witness is only a proxy for technical/advanced vocabulary. Its purpose is to
catch systematic blindness: if the static index repeatedly fails to even evaluate
large portions of the corpus's distinctive vocabulary, try alternative static
feature hypotheses and compare their marginal coverage/cost. If the established
static basis already covers the useful witness set, the correct dynamic decision is
to do nothing. The audit belongs in development experiments, not the reader UI.

## Utility and stopping

Index purity is not the objective. User utility is.

False positives in a browsable glossary are usually cheap: the reader skips an
irrelevant entry. False negatives can be expensive: the unique project or answer
may become invisible. Provenance failures are catastrophic.

Therefore:

- bias navigation toward recall when nuisance remains low,
- fix systematic invisibility before cosmetic noise,
- prefer a useful 80-95% surface to an expensive "perfect" ontology,
- add machinery only when a concrete failure class materially changes the
  reader's ability to learn, investigate, or decide.

The static layer is done enough when further refinement produces less utility
than improving the Librarian, episode recovery, or the reading experience.

## Success questions

The important evaluations are human-operational:

- How many consequential reasoning/navigation jumps from intention to useful
  evidence?
- Can a reader with no initial question repeatedly discover worthwhile things?
- Does the contents page expose the major territory without requiring the reader
  to understand the corpus?
- Does the glossary make obscure but valuable details reachable?
- Can the Librarian turn partial evidence into a better next search rather than a
  longer answer?
- When evidence is insufficient, does it identify what remains unresolved?
- Does each added mechanism materially reduce a real failure class?

That is the target: a messy community archive compiled into a navigable
intellectual landscape whose machinery disappears behind the reader's intent.
