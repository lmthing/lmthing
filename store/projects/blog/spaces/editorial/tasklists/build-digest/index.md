---
input:
  query: string
---

Assemble a digest end-to-end: gather recent candidate articles ranked by score and engagement,
cluster and dedupe them by topic, then write the digest and its ordered items. This tasklist takes
**no article id from the caller** — it self-queries. The `write` step looks for a digest the
`buildDigest` API pre-seeded (`status: 'building'`) and fills it in; if there is none (the daily
cron or a chat request), it inserts a brand-new `ready` digest. `query` is the (ignored) invocation
message the bound-action convention passes; the real inputs are the db rows the tasks read.
