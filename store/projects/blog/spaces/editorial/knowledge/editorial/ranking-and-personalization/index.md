---
variable: rankingAndPersonalization
description: How reading-event signals translate into topic weights and article scores, and the ethical duty to keep the feed personalized without trapping the reader in a filter bubble.
---

# Ranking and personalization

The feed's personalization loop is deliberately small and legible: a reader's `reading_events`
(open, save, dwell, dismiss) nudge `topics.weight` up or down for the tag involved, and those
weights are then summed across an article's tags to produce its `score` — the number that decides
what surfaces first. There is no black-box model here; every score is explainable as "this article's
tags matched topics the reader has shown interest in, to this degree." That legibility is a feature,
not a limitation — it's what lets the personalizer be a small, auditable agent rather than a
mysterious ranking service, and it's what lets a curious reader look at their Topics page and
actually understand why their feed looks the way it does.

Two concerns govern how this loop is built and tuned:

1. **Which signals mean what, and how strongly.** Not all engagement is equal — a deliberate `save`
   says much more about genuine interest than a `dwell` that might just mean the reader stepped away
   from their screen. `signals-and-weights.md` covers the reasoning behind each signal's weight and
   why weights decay/bound the way they do (see `computeTopicWeights` and `summarizeEngagement`).

2. **The ethical duty not to trap the reader.** A personalization loop that only ever reinforces past
   behavior converges toward an increasingly narrow feed — today's slight preference for one topic
   becomes tomorrow's near-total absence of everything else. `avoiding-filter-bubbles.md` covers the
   concrete practices (weight clamping, deliberate serendipity, respecting mutes without over-pruning
   breadth) that keep personalization useful without becoming a trap.

The personalizer is the only agent that writes `topics.weight` and `articles.score` — the curator and
digest-writer read scores to decide what's worth featuring, but neither one adjusts them.
