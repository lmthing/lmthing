---
input:
  trigger: string
---

Compute the morning digest of trends and flagged findings, and persist insights. `trigger` is not
threaded into the tasks below — like the interpreter's `digest` action this tasklist parallels, the
cron that starts this run carries no id, so `gather` self-queries the actual state from the
database: recent lab results, active symptoms, and metrics. `trends` computes rolling per-kind
metric trends over that data, and `write-insights` persists any notable trend or plausible
correlation/anomaly as an `insights` row, deduping against what's already been written today.
