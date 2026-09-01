---
id: record
dependsOn: [scan]
role: general
capabilities: [db:read, db:write]
functions: []
output:
  recorded: number
  duplicates: number
  staleWatchers: number
  ok: boolean
---

Record the due items as `deadline_alerts` rows — check-before-insert on `dedupeKey`, every time.
`scan` is the collected fan-out output: one `{ watcherId, targetTable, dueItems, tableMissing }`
per watcher (a skipped branch contributes nothing).

```ts
const branches = (scan ?? []).filter((b: any) => b && typeof b === 'object');
const staleWatchers = branches.filter((b: any) => b.tableMissing === true).length;
```

```ts
let recorded = 0, duplicates = 0;
const now = new Date().toISOString();
for (const b of branches) {
  for (const d of (b.dueItems ?? [])) {
    const existing = db.query('deadline_alerts', { where: { dedupeKey: d.dedupeKey } });
    if (existing.length > 0) { duplicates++; continue; }
    db.insert('deadline_alerts', {
      watcherId: b.watcherId,
      targetTable: b.targetTable,
      rowId: d.rowId,
      dueAt: d.dueAt,
      daysLeft: d.daysLeft,
      label: d.label,
      dedupeKey: d.dedupeKey,
      status: 'open',
      createdAt: now,
    });
    recorded++;
  }
}
currentTask.resolve({ recorded, duplicates, staleWatchers, ok: true });
```

Insert alerts exactly as computed — never adjust a label, date, or `daysLeft`. Never change any
alert's `status` here (that's a `review` decision), and never touch a host-app table. Each insert
auto-emits `project/db.deadline_alerts.insert` for downstream consumers — that emission IS the
notification path; do not attempt any delivery yourself.
