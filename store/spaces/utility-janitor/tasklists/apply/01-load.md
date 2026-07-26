---
id: load
dependsOn: []
role: explore
functions: []
output:
  approved: array
  count: number
---

Load the work — **approved findings only**. This `where` clause is the space's safety interlock:
a `proposed` finding has not been through a human, and must never reach the apply step.

```ts
const approved = db.query('janitor_findings', { where: { status: 'approved' } });
currentTask.resolve({ approved, count: approved.length });
```

Do not widen the filter, do not merge in `proposed` rows, and do not re-rank or drop rows on
intuition. If the table doesn't exist yet (scan never ran), resolve `{ approved: [], count: 0 }` —
nothing to apply is a valid state, not an error.
