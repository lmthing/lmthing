---
input:
  trigger: string?
---

Record what changed: load the active audit bindings, diff each bound table's current rows against
its `audit_snapshots`, append deduped `audit_log` entries, and bring the snapshots back in line
with reality. The first sweep of a table is a baseline — snapshots only, no log entries. `trigger`
is not threaded in: the daily cron hook carries no structured input, so the sweep self-queries its
work and every insert dedupes on `changeKey`, making re-runs free.
