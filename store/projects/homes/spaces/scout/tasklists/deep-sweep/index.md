---
input:
  searchId: string
---

A periodic, read-mostly re-verification pass over one search's most consequential listings — not
triggered by any single insert, run occasionally to catch what a first-pass analysis might have
missed or gotten wrong. Picks a bounded batch worth a second look, re-runs the analyst against each,
then writes up what changed. No single re-check is critical: this is the fan-out pattern where one
slow or failed fork produces a partial result and the sweep still completes rather than being sunk
by it.
