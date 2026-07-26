---
input:
  trigger: string?
---

Find data-quality problems and queue them as proposals: inventory the host project's tables with
real sampled rows, run the duplicate / normalization / orphan detectors per table, then create this
space's own table (if absent) and insert deduped `janitor_findings` rows — all at `status:
'proposed'`. `trigger` is not threaded into the steps: the scan self-queries everything it needs,
and every insert dedupes on `findingKey`, so a re-run (including the daily cron) is always safe and
changes nothing in the host app.
