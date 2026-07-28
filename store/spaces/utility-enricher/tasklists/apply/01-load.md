---
id: load
dependsOn: []
role: explore
functions: []
output:
  approved: array
  count: number
---

Load the work — `approved` tasks and nothing else. `pending`, `proposed`, `not-found`, `rejected`
and `applied` rows are all out of scope here; the status filter IS the approval gate.

```ts
const approved = db.query('enrich_tasks', { where: { status: 'approved' } });
currentTask.resolve({ approved, count: approved.length });
```

If `enrich_tasks` does not exist yet, or nothing is approved, resolve
`{ approved: [], count: 0 }` — an empty approval queue is a valid state, not an error. Do not widen
the filter to "find something to do".
