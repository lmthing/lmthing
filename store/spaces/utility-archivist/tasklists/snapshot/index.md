---
input:
  trigger: string?
---

Capture the weekly snapshot: gate the run to Sunday (UTC), load the active policies with snapshots
enabled, and write one stable-JSON `archive_snapshots` row per table per day. `trigger` is not
threaded into the steps — the daily cron hook carries no structured input, so the run self-queries
its work and every insert dedupes on `snapshotKey`, making re-fires and manual re-runs free. On any
other day the gate closes and the run reports that it did nothing, which is the expected outcome
six days out of seven.
