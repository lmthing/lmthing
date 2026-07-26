---
id: record
dependsOn: [research]
role: general
capabilities: [db:read, db:write]
functions: []
output:
  proposed: number
  notFound: number
  ok: boolean
---

Record the research outcomes into `enrich_tasks` — and into nothing else. `research` is the
collected fan-out output: one `{ taskId, found, proposedValue, sourceUrl, reason }` per task (a
skipped branch contributes nothing).

```ts
const branches = (research ?? []).filter((b: any) => b && typeof b === 'object' && b.taskId);
```

```ts
let proposed = 0, notFound = 0;
for (const b of branches) {
  if (b.found === true && String(b.sourceUrl ?? '') !== '') {
    db.update('enrich_tasks', {
      where: { id: b.taskId },
      set: { status: 'proposed', proposedValue: String(b.proposedValue ?? ''), sourceUrl: String(b.sourceUrl), reason: '' },
    });
    proposed++;
  } else {
    db.update('enrich_tasks', {
      where: { id: b.taskId },
      set: { status: 'not-found', proposedValue: '', sourceUrl: '', reason: String(b.reason ?? 'no source found') },
    });
    notFound++;
  }
}
currentTask.resolve({ proposed, notFound, ok: true });
```

A branch claiming `found: true` with an empty `sourceUrl` is recorded as `not-found` — an uncited
value is not a value. Do not "fix" it by searching yourself; this step does no research.

Write ONLY `enrich_tasks` here. **No host-app table is touched by research** — a proposed value has
not been approved by anyone yet, and `apply` is the only action allowed to patch a real row. Never
set `status: 'approved'` from this step: approval is a human act.
