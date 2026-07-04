# Accuracy and provenance

## Provenance is the whole point

Every `articles` row already has a provenance chain — its `citations` rows point back to the
`raw_items` it was synthesized from, with the specific quote the synthesizer relied on. The
editorial desk doesn't add new citations, but it must never write anything that breaks that chain's
usefulness: a digest blurb, a subject line, or an editor's note should be a claim a reader could
trace back through the article to its citation and find actually supported. Treat every article you
curate as if a skeptical reader will click through and check — because on lmthing.blog, they can.

## What "grounded" means for the curator, digest-writer, and personalizer

None of the editorial desk's three agents have `webSearch`/`webFetch` — by design, they work only
from what's already in the database. That constraint is itself an accuracy safeguard: it's
structurally impossible to fabricate a new fact when the only inputs available are rows that already
exist. The discipline this requires is different from the synthesizer's or researcher's: it's not
"go verify this," it's "never add anything beyond what the row already says." A digest blurb should
compress `articles.summary`/`articles.body`, not embellish it; a newsletter section should restate
what a digest item already says, not editorialize new claims into it.

## Correction posture

Because nothing in this space fetches live sources, the most common way something goes stale is not
"the article was wrong" but "the world changed after the fact" (a benchmark gets challenged, a
company issues a follow-up). The editorial desk has no dedicated correction workflow — the right
posture is:

- Never silently edit an already-published `articles` row's substance to make a past digest look
  more correct in hindsight. If something needs correcting, that's the newsroom researcher/
  synthesizer's job, not the editorial desk's.
- When curating, prefer the most recent article on a fast-moving topic over an older one that a
  newer one has effectively superseded — that is a selection decision (see `digest-craft`), not a
  correction of the older article.
- An editor's note (`articles.editorNote`) is fair game for a brief, honest caveat ("a related
  correction ran two days later") when the curator is aware of one — but it must point at something
  real (another article, a citation), never assert a correction that hasn't actually happened.
