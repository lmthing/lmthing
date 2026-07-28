---
id: mark
dependsOn: [apply]
role: general
capabilities: [db:read, db:write]
functions: []
output:
  marked: number
  failed: number
  ok: boolean
---

Close the loop: findings whose patch actually reached the row move to `status: 'applied'`. `apply`
is the collected fan-out output: one `{ findingId, applied, reason? }` per approved finding (a
skipped branch contributes nothing).

```ts
const branches = (apply ?? []).filter((b: any) => b && typeof b === 'object');
const succeeded = branches.filter((b: any) => b.applied === true);
const failed = branches.length - succeeded.length;
```

```ts
let marked = 0;
for (const b of succeeded) {
  db.update('janitor_findings', { where: { id: b.findingId }, set: { status: 'applied' } });
  marked++;
}
currentTask.resolve({ marked, failed, ok: true });
```

Mark ONLY the successful branches. A finding that failed (`bad-patch`, or a no-patch finding) stays
`approved` so it resurfaces next run and stays visible in review — never mark it `applied` on
optimism, and never quietly reject it on the user's behalf. This step writes `janitor_findings`
only; the host-app write already happened upstream.
