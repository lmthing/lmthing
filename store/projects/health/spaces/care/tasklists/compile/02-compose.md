---
id: compose
output:
  compiled: number
dependsOn: [gather]
goal: true
functions:
  - buildCareSummary
---

Call `buildCareSummary` once per pending share from `gather`'s record — never hand-roll the
markdown formatting in prose — then mark each share ready:

```ts
let compiled = 0;
for (const share of gather.shares) {
  const body = buildCareSummary({
    scope: share.scope,
    labs: gather.labs,
    medications: gather.medications,
    insights: gather.insights,
    appointments: gather.appointments,
    contacts: gather.contacts,
  });
  db.update('care_shares', { where: { id: share.id }, set: { body, status: 'ready' } });
  compiled++;
}
currentTask.resolve({ compiled });
```

This is the tasklist's goal task — its resolved `{ compiled }` count is what this tasklist reports
back to whatever triggered it. Each `care_shares` update is an UPDATE, not an insert, so it never
re-fires `hooks/compile-care-share.ts` (insert-only) — the whole `compile` tasklist is bounded to
one reconcile per run.
