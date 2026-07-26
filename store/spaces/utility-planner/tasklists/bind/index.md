---
input:
  trigger: string?
---

Discover the schedule-bearing columns in the host project and persist binding rows: inventory the
schema with real sampled rows, classify candidates (and their `kind`) with
`discoverScheduleColumns`, then create this space's own table (if absent) and insert deduped
`planner_bindings` rows — `active` when confident, `proposed` otherwise. `trigger` is not threaded
into the steps: bind self-queries everything it needs from the database, so a re-run is always safe.
