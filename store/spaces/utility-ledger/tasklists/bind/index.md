---
input:
  trigger: string?
---

Discover money column sets in the host project and persist binding rows: inventory the schema with
real sampled rows, classify (amount, date, category) candidates with `discoverAmountColumns`, then
create this space's own tables (if absent) and insert deduped `ledger_bindings` rows — `active`
when confident, `proposed` otherwise. `trigger` is not threaded into the steps: bind self-queries
everything it needs from the database, so a re-run is always safe.
