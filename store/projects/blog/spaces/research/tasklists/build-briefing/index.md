---
input:
  query: string
---

Produce one grounded, multi-source briefing end-to-end: survey the topic across the open web and
the existing feed, then write the briefing and mark it ready. This tasklist takes **no briefing id
from the caller** — it self-queries. The `survey` step prefers the oldest `briefings` row still
`status: 'pending'` (what the `requestBriefing` API seeds, and what the `generate-briefing` hook
delegates on) and falls back to `query` (the chat topic) when there is none; `write` fills that
pending row in, or inserts a fresh `ready` briefing for a free-form chat dive. `query` is the
(ignored, when a pending row exists) invocation message the bound-action convention passes — the
real input is the db rows the tasks read.
