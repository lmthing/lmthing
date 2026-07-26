---
id: record
dependsOn: [scan]
role: general
capabilities: [db:read, db:write]
functions: []
output:
  recorded: number
  duplicates: number
  autoResolved: number
  ok: boolean
---

Record new violations and close the ones the data has fixed. `scan` is the collected fan-out
output: one `{ targetTable, violations, scanned }` per table (a skipped branch contributes nothing).

```ts
const branches = (scan ?? []).filter((b: any) => b && typeof b === 'object');
const scannedTables = branches.filter((b: any) => b.scanned === true).map((b: any) => b.targetTable);
```

1. Insert every violation whose key is not already present:

```ts
let recorded = 0, duplicates = 0;
const now = new Date().toISOString();
const seenKeys = new Set<string>();
```

```ts
for (const b of branches) {
  for (const v of (b.violations ?? [])) {
    seenKeys.add(v.violationKey);
    const existing = db.query('validation_violations', { where: { violationKey: v.violationKey } });
    if (existing.length > 0) { duplicates++; continue; }
    db.insert('validation_violations', {
      ruleId: v.ruleId, targetTable: b.targetTable, rowId: v.rowId, reason: v.reason,
      violationKey: v.violationKey, status: 'open', createdAt: now,
    });
    recorded++;
  }
}
```

2. Auto-resolve: an `open` violation belonging to a table that **was actually scanned this sweep**,
   whose key was not produced now, means the rule ran and the row passes — close it:

```ts
let autoResolved = 0;
for (const v of db.query('validation_violations', { where: { status: 'open' } })) {
  if (!scannedTables.includes(v.targetTable)) continue; // not re-checked ⇒ not evidence of a fix
  if (seenKeys.has(v.violationKey)) continue;
  db.update('validation_violations', { where: { id: v.id }, set: { status: 'resolved' } });
  autoResolved++;
}
currentTask.resolve({ recorded, duplicates, autoResolved, ok: true });
```

The `scannedTables` guard is not optional: a table that failed, vanished or was never in this
sweep's rules must keep its violations untouched — silently closing something you did not re-check
is the worst outcome this space can produce. Never set `ignored` (a human decision), never re-open a
resolved or ignored violation, never edit a `reason`, and never touch a host-app table. Each insert
auto-emits `project/db.validation_violations.insert` for downstream consumers.
