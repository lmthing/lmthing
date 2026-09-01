---
id: record
dependsOn: [load, diff]
role: general
capabilities: [db:read, db:write]
functions:
  - computeChangeKey
output:
  added: number
  changed: number
  removed: number
  baselined: number
  duplicates: number
  staleBindings: number
  ok: boolean
---

Append the log entries and bring the snapshots back in line with reality. `diff` is the collected
fan-out output: one `{ targetTable, isBaseline, added, changed, removed, snapshotUpserts,
tableMissing }` per binding (a skipped branch contributes nothing).

```ts
const branches = (diff ?? []).filter((b: any) => b && typeof b === 'object');
const staleBindings = branches.filter((b: any) => b.tableMissing === true).length;
```

A **baseline** branch seeds `audit_snapshots` ONLY and writes NO `audit_log` entries — the auditor
arriving is not four thousand rows being added today. Count it as baselined and move on:

```ts
let addedCount = 0, changedCount = 0, removedCount = 0, baselined = 0, duplicates = 0;
const now = load.nowIso;
```

```ts
const append = (targetTable: string, rowId: string, change: string, beforeJson: string, afterJson: string, changedColumnsJson: string): boolean => {
  const key = computeChangeKey(targetTable, rowId, change, now);
  const existing = db.query('audit_log', { where: { changeKey: key } });
  if (existing.length > 0) { duplicates++; return false; }
  db.insert('audit_log', {
    targetTable, rowId, change, beforeJson, afterJson, changedColumnsJson,
    changeKey: key, sweepAt: now, createdAt: now,
  });
  return true;
};
```

```ts
for (const b of branches) {
  if (b.tableMissing === true) continue;
  if (b.isBaseline === true) { baselined++; continue; }
  for (const a of (b.added ?? [])) if (append(b.targetTable, a.rowId, 'added', '', a.afterJson, '[]')) addedCount++;
  for (const c of (b.changed ?? [])) if (append(b.targetTable, c.rowId, 'changed', c.beforeJson, c.afterJson, c.changedColumnsJson)) changedCount++;
  for (const r of (b.removed ?? [])) if (append(b.targetTable, r.rowId, 'removed', r.beforeJson, '', '[]')) removedCount++;
}
```

Then upsert the snapshots for EVERY branch — baseline branches included, since seeding them is the
whole point of a baseline. There is no delete on your surface, so a removed row's snapshot is
**tombstoned**: `rowJson: ''`, `rowHash: 'removed'`. That sentinel is what stops the next sweep
from re-reporting the same deletion every day forever (the diff step skips snapshots already
carrying it):

```ts
for (const b of branches) {
  if (b.tableMissing === true) continue;
  for (const u of (b.snapshotUpserts ?? [])) {
    if (u.op === 'insert') {
      db.insert('audit_snapshots', { targetTable: b.targetTable, rowId: u.rowId, rowJson: u.rowJson, rowHash: u.rowHash, updatedAt: now });
    } else if (u.op === 'update') {
      db.update('audit_snapshots', { where: { id: u.snapshotId }, set: { rowJson: u.rowJson, rowHash: u.rowHash, updatedAt: now } });
    } else if (u.op === 'tombstone') {
      db.update('audit_snapshots', { where: { id: u.snapshotId }, set: { rowJson: '', rowHash: 'removed', updatedAt: now } });
    }
  }
}
currentTask.resolve({ added: addedCount, changed: changedCount, removed: removedCount, baselined, duplicates, staleBindings, ok: true });
```

Insert entries exactly as computed — never paraphrase a value, never edit or delete an existing
`audit_log` row (the log is append-only), and never touch a host-app table: your grant has no host
write, and that absence is the point. Each insert auto-emits `project/db.audit_log.insert` for
downstream consumers — that emission IS the notification path; do not attempt any delivery
yourself.
