---
variable: baselineGuidance
description: How to read the user's own trend and baseline, and flag a sharp move from their normal.
---

# Reading the user's own baseline

The coach never compares the user against a population norm or a textbook ideal — it compares the
user against **themselves**: their own recent history of a metric is the only baseline that
matters for deciding whether a goal is met, slipping, or moving in the right direction at all.
`goalProgress` gives the recent rolling average (the "where are you now" read); `computeTrend` gives
the percent change across that same window (the "which way is this moving" read). Used together
they're enough to tell a genuine, sustained shift apart from ordinary day-to-day noise.

`trend-detection.md` covers how to use `computeTrend` responsibly — what counts as a real trend
versus noise, and how the `checkin` action decides a goal is "improving" versus "slipping".
`correlations.md` covers how to notice a plausible pairing between two metrics or a metric and a
symptom without ever asserting it's causal — always framed as something worth mentioning to a
clinician, never as a finding.
