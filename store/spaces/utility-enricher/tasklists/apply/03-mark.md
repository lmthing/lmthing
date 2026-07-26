---
id: mark
dependsOn: [apply]
role: general
capabilities: [db:read, db:write]
functions: []
output:
  applied: number
  skipped: number
  ok: boolean
---

Close the loop in `enrich_tasks`: a task whose value actually landed becomes `applied`; one that
was skipped keeps its `approved` status and records WHY, so the user can see the conflict in
`review` and decide what to do.

```ts
const branches = (apply ?? []).filter((b: any) => b && typeof b === 'object' && b.taskId);
```

```ts
let applied = 0, skipped = 0;
const now = new Date().toISOString();
for (const b of branches) {
  if (b.applied === true) {
    db.update('enrich_tasks', { where: { id: b.taskId }, set: { status: 'applied', reason: '', createdAt: now } });
    applied++;
  } else {
    db.update('enrich_tasks', { where: { id: b.taskId }, set: { reason: String(b.reason ?? 'not applied') } });
    skipped++;
  }
}
currentTask.resolve({ applied, skipped, ok: true });
```

Only branches that resolved `applied: true` may be marked `applied` — never mark a task from
intent. Write ONLY `enrich_tasks` here; the host rows were already written (or deliberately not
written) upstream.
