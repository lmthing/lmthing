---
input:
  trigger: string?
---

Name the rows that have aged past a retention window the user set: load the active policies that
actually have a `retentionColumn` and a positive `keepDays`, list each table's candidates with the
pure day math, and record one `archive_reports` row per table per day. `trigger` is not threaded
into the steps — the run self-queries its work and dedupes on `reportKey`. **Nothing is deleted.**
The report names candidates; removing them is the user's act, in their own app.
