---
input:
  query: string
---

Produce one grounded deep-dive report end-to-end: survey the topic with real search and fetches,
then write the report and mark it ready. Structured input is **not** delivered across the hook/spawn
boundary, so this tasklist **self-queries** rather than trusting a passed id: `survey` prefers the
oldest `research` row still in `status: 'pending'` (what the `requestResearch` API seeds) and falls
back to `query` (the chat topic) when there is none; `write` fills that pending row in, or inserts a
fresh `research` row for a free-form chat dive.
