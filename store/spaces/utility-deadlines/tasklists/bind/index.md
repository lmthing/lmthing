---
input:
  trigger: string?
---

Discover date-like columns in the host project and persist watcher rows: inventory the schema with
real sampled rows, classify candidates with `discoverDateColumns`, then create this space's own
tables (if absent) and insert deduped `deadline_watchers` rows — `active` when confident,
`proposed` otherwise. `trigger` is not threaded into the steps: bind self-queries everything it
needs from the database, so a re-run is always safe.
