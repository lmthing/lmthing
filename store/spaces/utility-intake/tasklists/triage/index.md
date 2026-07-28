---
input:
  trigger: string?
---

Route every pending inbox item: load the pending items and the active rules, match and project each
one in parallel, then mark each item with what actually happened. `trigger` is not threaded in —
the insert hook carries no id, so triage self-queries all `pending` items, which coalesces a burst
of arrivals into a single idempotent pass.
