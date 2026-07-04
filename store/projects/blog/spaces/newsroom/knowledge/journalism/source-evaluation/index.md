---
variable: sourceEvaluation
description: Judging which sources and items are worth polling and citing, and detecting when two items are really the same story so the feed doesn't fill up with near-duplicates.
---

# Evaluating sources and items well

The newsroom's feed is only as trustworthy as the material that enters it, and two different
agents are the gatekeepers: the fetcher decides what becomes a `raw_items` row at all, and the
synthesizer decides (implicitly, through `clusterKey`) whether a new article duplicates one already
in the feed. Neither agent writes prose from scratch here — this is about judgment applied to
material that already exists, either a feed/search source or a batch of freshly fetched items.

Source evaluation matters most at two moments. First, when the fetcher is polling: not every entry
a `search`-kind source turns up is worth recording as a `raw_items` row — a search for a topic will
surface stale reposts, content-farm rewrites of someone else's reporting, and results that only
tangentially mention the topic. Second, when the synthesizer is about to insert a new article: if a
near-identical story already ran (a wire story picked up by many outlets, or a follow-up on
something already covered), inserting yet another near-duplicate article degrades the feed even if
each individual article is itself honest and well-written — the reader experience of seeing the
same story five times is a real cost, distinct from any single article's quality.

`credibility-signals.md` covers what makes a source/item worth recording versus skipping —
recognizing thin or low-substance results, and preferring primary/first-hand reporting over
aggregation. `dedup-and-clustering.md` covers the practical mechanics of collapsing near-duplicate
stories via `articles.clusterKey`, including how to derive a stable key and when two stories that
look similar are actually genuinely distinct and should both stay.
