---
input:
  trigger: string?
---

Report where personal data appears to live: sample every host table, scan each one for
email-, phone-, IBAN- and card-shaped values, and record one `archive_reports` row per table per
day for the tables that had findings. Reports store the column, the kind and the count — **never
the matched values**. `trigger` is not threaded into the steps: the run self-queries its work and
dedupes on `reportKey`, so a re-run is free.
