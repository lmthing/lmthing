---
input:
  trigger: string?
---

Check every active data contract: load the active rules grouped by table, evaluate each table's
rows once against all its rules, then insert deduped `validation_violations` rows and auto-resolve
the open violations the data has since fixed. `trigger` is not threaded in — the daily cron hook
carries no structured input, so the check self-queries its work and every insert dedupes on
`violationKey`, making re-runs free.
