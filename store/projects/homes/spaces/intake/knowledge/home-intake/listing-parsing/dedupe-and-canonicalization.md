# Dedupe and canonicalization

## Why coarse bands, not exact matches

The same physical unit is routinely cross-posted on two or three portals with slightly different
formatting: one site rounds size to the nearest 5 m², another quotes the exact figure; one lists
€1,600, a re-post three weeks later says €1,650. An exact-match dedupe key would treat these as four
different listings and clutter the feed with duplicates the user has to notice and dismiss by hand.
`dedupeKey` deliberately bands two of its four components — a 5 m² size bucket and a ~5% log-scaled
price bucket — so that two postings of the same unit collapse onto the same key even when the
portals didn't quote it identically, while a genuinely different unit two doors down (different
size band, different price band) still gets its own row.

## What coarse banding costs, and where the line is drawn

Coarseness is a deliberate trade: a FEW genuinely-different-but-similar units might theoretically
share a key (say, two near-identical studios in the same building at the same rent). In practice
this is rare enough, and the cost of a false merge (losing track of one listing) is worse than the
cost of an occasional false split (a duplicate the user dismisses in one tap) — so when `dedupeKey`
does produce an exact match, the clipper merges without asking. The one case treated differently is
the BORDERLINE one: same normalized address, same room count, same size band, but a DIFFERENT price
band. That's exactly the signature of "same address, but did the price actually change or is this a
different unit in the same building?" — a question the clipper can't answer from text alone, so it's
surfaced rather than decided silently in either direction (merge, which would erase a real price
difference, or split, which clutters the feed).

## Merge semantics

A merge into an existing listing is additive, never destructive: `portal` becomes the union of every
source label seen (comma-joined, e.g. `"idealista, imovirtual"`), `url` keeps whichever of the two is
already the canonical one (never overwritten with a lesser link), and `lastSeenAt` bumps to now — this
is also how a listing that had gone quiet gets a signal that it's still live, ahead of the next
scheduled refresh.
