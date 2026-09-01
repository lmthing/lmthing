---
input:
  trigger: string?
---

Compose one weekly digest of the host project's data: gate on the day of week, inventory the schema
with real sampled rows, profile each table with the pure functions, compose a report from those
numbers only, and record it as a single deduped `insight_reports` row. `trigger` is not threaded
into the steps — the cron hook carries no structured input, so the digest self-queries everything it
needs and dedupes on `week:<isoWeek>`, making a re-run free.
