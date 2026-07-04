---
variable: destinationResearch
description: How to research a destination well — triangulating real sources, structuring a grounded report, and judging whether a place or activity is actually worth a traveller's limited time.
---

# Researching a destination well

Good destination research is the difference between an itinerary that reads like a copy-pasted
"Top 10 things to do in X" listicle and one that actually reflects what a specific traveller, with
specific tastes and a specific amount of time, should do. The researcher agent's job is not to
produce the longest possible list of attractions — it's to produce a short, honest, sourced report
that the scheduler can turn into a realistic day plan, and that a human reading it would trust.

Two things matter above all else:

1. **Everything in the report must trace back to a real source.** The researcher has `webSearch`
   and `webFetch` for exactly this reason — every claim about opening hours, price, "best time of
   day", or "this is skippable" should be grounded in something actually retrieved, not pattern-
   matched from the model's prior knowledge of "what these kinds of cities are usually like." When
   a source can't be found or fetched, that's a signal to say so (`status: 'error'`), not a
   invitation to fill the gap with something plausible-sounding.

2. **A report should help someone decide, not just list.** The most useful research answers: what
   is genuinely worth the traveller's time given their stated tastes, what's a trap, what's the
   rough cost, and what's the ideal pace (half a day vs. a full day, morning vs. evening). This
   overview is expanded in `evaluating-worth.md`; the mechanics of finding and structuring the
   underlying sources are in `sources-and-method.md`.

A destination-research report is the raw material the scheduler works from when it lays out
`itinerary_items` — it should be detailed enough that the scheduler doesn't need to re-research
anything, just sequence and time-box what's already there.
