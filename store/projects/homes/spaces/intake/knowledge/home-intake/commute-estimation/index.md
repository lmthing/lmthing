---
variable: commuteEstimation
description: How the surveyor turns a search's commuteTargets into cited, honest minute estimates from a listing's best-known location — for the normalize/commute actions' webSearch-grounded lookups.
---

# Estimating commutes

A search's `commuteTargets` (office, a partner's workplace, a regular gym, family) are often the
actual deciding factor on a shortlist — two otherwise-similar listings can differ by 20 minutes of
daily commute, which compounds into hours a week. `commutes.basis` exists so that number is never a
bare guess: it always names the mode, the target, and — crucially — WHICH location the estimate
started from (the listing's claimed, often-fuzzed pin, or a tighter `location_guesses` circle once
the locator has run).

`transit-heuristics.md` covers how to ground a transit-time estimate in an actual `webSearch` rather
than a straight-line assumption; `mode-tradeoffs.md` covers when walk/bike/drive estimates diverge
sharply from transit and why that divergence itself is worth surfacing to the user rather than
picking one mode silently.
