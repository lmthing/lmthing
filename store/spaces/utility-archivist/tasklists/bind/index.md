---
input:
  trigger: string?
---

Discover the host project's tables and give each one a policy row: inventory the schema with real
sampled rows, propose one `archive_policies` row per table (snapshots on, retention deliberately
unset), then create this space's own tables (if absent) and insert the deduped policies. `trigger`
is not threaded into the steps: bind self-queries everything it needs from the database, so a
re-run is always safe and never duplicates or resurrects a policy.
