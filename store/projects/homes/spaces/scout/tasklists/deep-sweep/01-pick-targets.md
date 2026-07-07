---
id: pick_targets
output:
  listingIds: array
dependsOn: []
role: plan
---

Pick a bounded batch of listings worth a deeper re-verification pass for this search (`searchId` is
in scope from the tasklist input) — favor the highest-scoring, still-live listings (worth
double-checking before someone acts on one) over long-dismissed or gone ones, capped so the sweep
stays bounded regardless of how large the search has grown:

```ts
const listings = db
  .query('listings', { where: { searchId } })
  .filter((l) => l.status !== 'dismissed' && l.status !== 'gone')
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

currentTask.resolve({ listingIds: listings.map((l) => l.id) });
```
