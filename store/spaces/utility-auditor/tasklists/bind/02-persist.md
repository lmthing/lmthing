---
id: persist
dependsOn: [inventory]
role: general
capabilities: [db:read, db:write, db:schema]
functions: []
output:
  inserted: number
  skippedExisting: number
  ok: boolean
---

Persist one binding per eligible table into this space's own tables — idempotently.

1. Ensure the own tables exist (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('audit_bindings')) {
  db.createTable('audit_bindings', {
    targetTable: 'string', status: 'string', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('audit_snapshots')) {
  db.createTable('audit_snapshots', {
    targetTable: 'string', rowId: 'string', rowJson: 'string', rowHash: 'string', updatedAt: 'string',
  });
}
```

```ts
if (!existing.includes('audit_log')) {
  db.createTable('audit_log', {
    targetTable: 'string', rowId: 'string', change: 'string', beforeJson: 'string',
    afterJson: 'string', changedColumnsJson: 'string', changeKey: 'string', sweepAt: 'string',
    createdAt: 'string',
  });
}
```

All three are created here, even though only `audit_bindings` is written in this pass — the sweep
must never have to create a table mid-flight.

2. Insert one binding per eligible table unless that `targetTable` already has ANY binding row —
   whatever its status. Re-binding must never duplicate, and must never resurrect a binding the
   user disabled:

```ts
let inserted = 0, skippedExisting = 0;
const now = new Date().toISOString();
for (const targetTable of inventory.eligible) {
  const dupes = db.query('audit_bindings', { where: { targetTable } });
  if (dupes.length > 0) { skippedExisting++; continue; }
  db.insert('audit_bindings', { targetTable, status: 'proposed', createdAt: now });
  inserted++;
}
currentTask.resolve({ inserted, skippedExisting, ok: true });
```

Every new binding lands as `proposed`, never `active` — auditing a table means copying its rows
into `audit_snapshots`, which is a storage and a privacy decision the user makes, not one the
classifier makes for them. Write ONLY `audit_bindings`/`audit_snapshots`/`audit_log` — no host-app
table, ever (the grant enforces this; don't fight the typecheck).
