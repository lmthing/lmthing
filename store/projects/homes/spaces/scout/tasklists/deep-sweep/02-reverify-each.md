---
id: reverify_each
output:
  ok: boolean
dependsOn: [pick_targets]
forEach: pick_targets.listingIds
optional: true
role: explore
canDelegateTo:
  - scout/analyst#analyze
---

Fans out over each listing id from `pick_targets`. `item` is one listing id — delegate the analyst
for a fresh pass. Passing an explicit `listingId` here deliberately overrides the analyst's normal
"skip if already analyzed" self-scan (see the analyst's `analyze` action), which is the whole point
of a deep sweep: get a second, better-informed look at a listing that already has an analysis.

```ts
await delegate('scout/analyst', 'analyze', { input: { listingId: item } });
currentTask.resolve({ ok: true });
```

This task is `optional`: one slow or failed fork (a listing that's since gone offline, a fetch that
times out) must not sink the whole sweep — the write step below simply works with whichever forks
actually completed.
