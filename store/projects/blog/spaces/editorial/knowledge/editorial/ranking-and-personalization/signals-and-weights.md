# Signals and weights

## What each signal actually implies

`reading_events.kind` carries four possible values, and each implies a different strength and
direction of interest:

- **`open`** — the weakest positive signal. Opening an article means the headline/summary was
  interesting enough to click, but says nothing about whether the reader actually found the content
  worthwhile. Small nudge (`computeTopicWeights` uses `+0.15`).
- **`save`** — a strong, deliberate positive signal. Bookmarking something for later is an active
  choice that survives past the moment of reading, and is the closest thing to an explicit "I want
  more of this" the reader gives. Larger nudge (`+0.4`).
- **`dwell`** — a positive signal whose strength scales with time spent, but it's an imperfect proxy
  (a reader might walk away mid-article) — so it's capped rather than allowed to compound
  unboundedly (`min(dwellMs / 120000, 0.5)`, i.e. at most +0.5 regardless of how long the tab sat
  open).
- **`dismiss`** — a clear negative signal. A reader actively dismissing an article from their feed is
  the strongest "less of this" signal available, so it carries the largest single-event weight
  (`-0.5`), roughly matching the ceiling of the strongest positive signal (`save`) so one deliberate
  dismissal can meaningfully offset a save.

## Why nudges are small and additive rather than multiplicative

`topics.weight` starts at `1` (neutral) and is nudged additively, clamped to `[0.1, 5]`. Additive,
bounded nudges mean:

- No single event can zero out a topic (`0.1` floor) or send it to infinity (`5` ceiling) — a reader
  who dismisses one article about a topic they otherwise like isn't permanently exiled from it.
- Weight drifts gradually across many events, which mirrors how genuine interest actually forms —
  nobody's taste flips based on one click, and the ranking shouldn't behave as though it does.
- Because weights are bounded, `scoreByTopics` (which sums weights across an article's tags) stays
  in a predictable range too, keeping the whole system easy to reason about and debug.

## Decay and staleness

There is no separate time-decay job in this space — weight drift is implicitly bounded by the clamp
and by the fact that new events keep nudging it, so a topic the reader stops engaging with will
naturally stay near whatever it last settled at rather than actively decaying back toward `1`. If a
future iteration wants active decay (e.g. slowly pulling weight back toward `1` for topics with no
recent events), that's an explicit product decision to make deliberately — don't invent decay
behavior inside `learn`/`rescore` that isn't in the schema or the functions provided.
