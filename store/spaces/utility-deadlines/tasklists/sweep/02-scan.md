---
id: scan
dependsOn: [load]
forEach: load.watchers
optional: true
role: explore
functions:
  - computeDueItems
  - makeDedupeKey
output:
  watcherId: string
  targetTable: string
  dueItems: array
  tableMissing: boolean
---

Scan ONE watcher (`item`) — read its table, run the window math, and hand the due items (with
their dedupe keys pre-computed) to the recording step. Read-only here; recording is the next
step's job.

```ts
const tableNames = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!tableNames.includes(item.targetTable)) {
  // Schema drifted since bind — report it; never fail the whole sweep over one stale watcher.
  currentTask.resolve({ watcherId: String(item.id), targetTable: item.targetTable, dueItems: [], tableMissing: true });
}
```

```ts
const rows = db.query(item.targetTable);
const due = computeDueItems(rows, item.targetColumn, item.leadDays, load.nowIso, item.labelColumn || undefined);
const dueItems = due.map(d => ({
  ...d,
  dedupeKey: makeDedupeKey(item.targetTable, d.rowId, item.targetColumn, d.dueAt),
}));
currentTask.resolve({ watcherId: String(item.id), targetTable: item.targetTable, dueItems, tableMissing: false });
```

`where` is equality-only — you loaded ALL rows deliberately; `computeDueItems` does the filtering
in memory. Never re-implement the window math inline, and never adjust a computed `daysLeft`.
