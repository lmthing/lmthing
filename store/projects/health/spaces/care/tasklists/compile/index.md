---
input:
  trigger: string
---

Compile every pending `care_shares` row into a printable care-summary markdown. `trigger` is not
threaded into the tasks below — like the coordinator's `compile` action this tasklist parallels,
the hook that starts this run carries no id, so `gather` self-queries the actual pending work
(flagged labs, active medications with adherence, recent insights, upcoming appointments, and care
contacts) and `compose` calls `buildCareSummary` to assemble the markdown body and marks each share
ready.
