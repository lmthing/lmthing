---
id: gather
dependsOn: []
role: general
functions:
  - summarizeEngagement
output:
  articleIds: array
  topicWeights: object
---

Gather a ranked candidate set of recent articles to consider for the digest. `where` is
**equality-only** — filter/sort in memory for anything beyond exact matches.

```ts
// Recent candidates: unread or already-high-scoring, capped to a manageable window.
const recent = db.query('articles')
  .filter(a => !a.read || a.score >= 50)
  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  .slice(0, 50);

// Current topic weights, keyed by slug, for scoring candidates.
const topics = db.query('topics');
const topicWeights: Record<string, number> = {};
for (const t of topics) topicWeights[t.slug] = t.weight ?? 1;

// Recent engagement, as a tie-breaker signal alongside score/weight.
const events = db.query('reading_events')
  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  .slice(0, 200);
const engagement = summarizeEngagement(events);

// Rank candidates: pinned first, then by score, then by engagement on their primary tag.
const ranked = recent.sort((a, b) => {
  if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
  const aEngagement = engagement.byTag[a.tags?.[0] ?? ''] ?? 0;
  const bEngagement = engagement.byTag[b.tags?.[0] ?? ''] ?? 0;
  return (b.score + bEngagement) - (a.score + aEngagement);
});

currentTask.resolve({ articleIds: ranked.map(a => a.id), topicWeights });
```

The candidate set is intentionally generous here (up to 50) — narrowing down to the final ~6-8
slots is the `cluster` task's job, not this one's.
