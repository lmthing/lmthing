---
input:
  trigger: string?
---

Record approaching deadlines: load the active watchers, scan each watcher's table with the pure
window math, and insert deduped `deadline_alerts` rows. `trigger` is not threaded in — the daily
cron hook carries no structured input, so the sweep self-queries its work and every insert dedupes
on `dedupeKey`, making re-runs free.
