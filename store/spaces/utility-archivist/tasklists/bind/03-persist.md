---
id: persist
dependsOn: [propose]
role: general
capabilities: [db:read, db:write, db:schema]
functions: []
output:
  inserted: number
  skippedExisting: number
  ok: boolean
---

Persist the proposed policies into this space's own tables — idempotently.

1. Ensure the own tables exist (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('archive_policies')) {
  db.createTable('archive_policies', {
    targetTable: 'string', snapshotEnabled: 'boolean', retentionColumn: 'string',
    keepDays: 'number', status: 'string', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('archive_snapshots')) {
  db.createTable('archive_snapshots', {
    targetTable: 'string', takenAt: 'string', rowCount: 'number', dataJson: 'string',
    snapshotKey: 'string', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('archive_reports')) {
  db.createTable('archive_reports', {
    kind: 'string', targetTable: 'string', detailJson: 'string', reportKey: 'string',
    status: 'string', createdAt: 'string',
  });
}
```

2. Insert each proposed policy unless its `targetTable` already has ANY policy row — whatever its
   status. Re-binding must never duplicate, and must never resurrect a policy the user disabled or
   silently wipe the retention window they set:

```ts
let inserted = 0, skippedExisting = 0;
const now = new Date().toISOString();
for (const p of propose.policies) {
  const dupes = db.query('archive_policies', { where: { targetTable: p.targetTable } });
  if (dupes.length > 0) { skippedExisting++; continue; }
  db.insert('archive_policies', { ...p, createdAt: now });
  inserted++;
}
currentTask.resolve({ inserted, skippedExisting, ok: true });
```

Write ONLY `archive_policies`/`archive_snapshots`/`archive_reports` — no host-app table, ever (the
grant enforces this; don't fight the typecheck). If `propose.policies` is empty, resolve
`{ inserted: 0, skippedExisting: 0, ok: true }` — an empty project is a valid outcome, not an error.
