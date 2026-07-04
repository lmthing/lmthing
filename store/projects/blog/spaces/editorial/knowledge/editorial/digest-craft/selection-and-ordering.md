# Selection and ordering

## Picking the field

Start from a reasonably wide recent window (the last ~50 candidate articles, unread or high-scoring)
rather than the whole archive — a digest is about what's fresh and worth surfacing now, not an
all-time-best list. From that field:

- **Dedupe first.** Near-identical coverage of the same story (shared `clusterKey`, or
  near-identical titles) should collapse to one slot before anything else happens — a digest with
  two slots covering the same underlying event reads as sloppy, not thorough.
- **Cluster by topic before picking.** Group the deduped candidates by their primary topic, then pick
  from across clusters rather than letting one over-represented topic (because it happened to have a
  busy news day) crowd out everything else. A digest that's 7 items but 5 of them are the same
  topic isn't a roundup, it's a topic newsletter that forgot its own scope.
- **Respect `pinned` articles.** An article the curator (or a human, via the curate UI) has pinned
  should get priority placement — pinning exists precisely so an editorially-important item isn't
  left to score alone to decide its fate.
- **Aim for ~6-8 slots.** Fewer than that and the digest feels thin; more than that and it stops
  being a curated roundup and starts being "everything from this week." When in doubt, cut the
  weakest/most-similar-to-another-slot item rather than pad up to a round number.

## Ordering for narrative

Once the slots are chosen, order matters as much as selection — a digest is read top to bottom, and
the sequence should feel like a briefing, not an arbitrary list:

- Lead with the single most consequential or most broadly relevant item — the one a reader would
  most regret missing if they only read the first entry.
- Group thematically adjacent items near each other rather than interleaving unrelated topics
  randomly, so the read has some flow.
- Close with something lighter or more niche rather than ending on the digest's weakest, most
  filler-feeling item — the last slot is what a reader remembers.

## Writing the blurb

Each `digest_items.blurb` is a single line answering "why does this matter, right now" — not a
restatement of the headline, and not the full summary already visible on the article card. A good
blurb adds the one piece of context or judgment that makes a reader decide to click: what's actually
new here, why it's a bigger deal than it might look, or what to watch for next. It must stay strictly
grounded in the article's own `summary`/`body` — see `editorial/editorial-standards` for the broader
rule against overstating.
