---
id: capture
dependsOn: [load]
forEach: load.policies
optional: true
role: general
capabilities: [db:read, db:write]
functions:
  - buildTableSnapshot
  - computeArchiveKey
output:
  targetTable: string
  captured: boolean
  rowCount: number
  reason: string
---

Capture ONE policy's table (`item`) as a snapshot row. This node writes, so it is `general` — but
it writes exactly one row, into `archive_snapshots`, and only when today's snapshot is missing.

1. Check first — one snapshot per table per day, always:

```ts
const key = computeArchiveKey('snapshot', item.targetTable, load.dayIso);
const existing = db.query('archive_snapshots', { where: { snapshotKey: key } });
```

```ts
if (existing.length > 0) {
  currentTask.resolve({ targetTable: item.targetTable, captured: false, rowCount: 0, reason: 'already-snapshotted-today' });
}
```

2. Confirm the table still exists — schema drifts between bind and today:

```ts
const tableNames = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!tableNames.includes(item.targetTable)) {
  currentTask.resolve({ targetTable: item.targetTable, captured: false, rowCount: 0, reason: 'table-missing' });
}
```

3. Read every row and serialize it with the stable stringifier — never `JSON.stringify` inline:
   key order must be deterministic, or next week's snapshot differs from this week's for no reason
   at all.

```ts
const rows = db.query(item.targetTable);
const snap = buildTableSnapshot(rows);
```

```ts
db.insert('archive_snapshots', {
  targetTable: item.targetTable,
  takenAt: load.dayIso,
  rowCount: snap.rowCount,
  dataJson: snap.dataJson,
  snapshotKey: key,
  createdAt: load.nowIso,
});
currentTask.resolve({ targetTable: item.targetTable, captured: true, rowCount: snap.rowCount, reason: '' });
```

Write ONLY `archive_snapshots` here. Never modify or delete a host row, never prune old snapshots
(there is no delete on your surface, and retiring old copies is the user's call), and never trim
`dataJson` to save space — a partial snapshot is worse than none because it looks complete.
