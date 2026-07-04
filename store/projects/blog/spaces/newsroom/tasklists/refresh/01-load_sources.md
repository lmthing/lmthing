---
id: load_sources
role: general
dependsOn: []
output:
  sourceIds: array
  knownUrls: array
---

Load the active sources and the set of URLs already recorded, so the fan-out that follows knows
what to fetch and what to skip. `db` `where` clauses are **equality-only** (no `LIKE`, no ranges),
and `active` needs an "is not explicitly false" check, so filter in memory:

```ts
const active = db.query('sources').filter(s => s.active !== false);
const known = db.query('raw_items').map(r => r.url);
currentTask.resolve({ sourceIds: active.map(s => s.id), knownUrls: known });
```
