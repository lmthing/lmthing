---
input:
  trigger: string?
---

Deliver what is new: load every active rule with its watermark, collect the queue rows created
since that watermark, render each into a digest, and hand the non-empty ones to their configured
channels — logging exactly one `dispatch_log` row per delivery. `trigger` is not threaded in; the
daily cron carries no structured input, so the run self-queries its work. Re-runs are free: the
watermark advances only on a logged delivery, and `batchKey` blocks a duplicate log.
