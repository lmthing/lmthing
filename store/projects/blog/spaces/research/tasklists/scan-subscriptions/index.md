---
input:
  query: string
---

Evaluate every active subscription against the recent article window and raise deduped alerts for
new matches: load the active subscriptions, the recent articles, and the alerts already raised,
match each subscription's saved query against each recent article, then insert only the genuinely
new alerts. `query` is the (ignored) invocation message the bound-action convention passes — the
real inputs are the db rows the tasks read; nothing here is taken from the caller.
