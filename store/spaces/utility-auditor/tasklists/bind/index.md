---
input:
  trigger: string?
---

Choose what to audit: list the host project's tables, drop the utility spaces' own bookkeeping
tables, then create this space's own tables (if absent) and insert one deduped `audit_bindings` row
per eligible table with `status: 'proposed'`. Nothing is swept until a human activates a binding.
`trigger` is not threaded into the steps: bind self-queries everything it needs from the database,
so a re-run is always safe.
