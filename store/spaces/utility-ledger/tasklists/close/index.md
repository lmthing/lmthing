---
input:
  trigger: string?
---

Close the previous calendar month: check whether today is the 1st, and if it is, load the active
bindings and their budgets, summarize each binding over the previous month with `summarizePeriod`,
and insert deduped `ledger_reports` rows. The daily cron hook fires this every morning — the gate
step makes every day but the 1st a cheap no-op. `trigger` is not threaded in: a cron delegate
carries no structured input, so close self-queries its work and dedupes on `reportKey`, making
re-runs free.
