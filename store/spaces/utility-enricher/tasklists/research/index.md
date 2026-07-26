---
input:
  trigger: string?
---

Answer the oldest pending enrichment tasks with real sources: take at most ten `pending` rows from
`enrich_tasks`, search and read for each one, validate whatever a source actually states, and
record the result — `proposed` with a value and its URL, or `not-found` with a reason. `trigger` is
not threaded into the steps: the run self-queries its work from the queue table, so it is always
safe to re-run, and a task is only ever moved out of `pending` once.
