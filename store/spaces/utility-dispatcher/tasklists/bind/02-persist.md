---
id: persist
dependsOn: [discover]
role: general
capabilities: [db:read, db:write, db:schema]
functions: []
output:
  inserted: number
  skippedExisting: number
  ok: boolean
---

Create this space's own tables if they are missing, then insert one rule per discovered source.

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('dispatch_rules')) {
  db.createTable('dispatch_rules', {
    sourceTable: 'string', channelRef: 'string', channelHint: 'string',
    label: 'string', status: 'string', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('dispatch_log')) {
  db.createTable('dispatch_log', {
    ruleId: 'string', batchKey: 'string', itemCount: 'number',
    lastSeenCreatedAt: 'string', deliveredVia: 'string', status: 'string', createdAt: 'string',
  });
}
```

```ts
let inserted = 0, skippedExisting = 0;
const now = new Date().toISOString();
for (const c of discover.candidates) {
  const dupes = db.query('dispatch_rules', { where: { sourceTable: c.table } });
  if (dupes.length > 0) { skippedExisting++; continue; }
  // channelRef stays EMPTY — a rule without a confirmed channel can never deliver.
  db.insert('dispatch_rules', {
    sourceTable: c.table, channelRef: '', channelHint: '',
    label: c.label, status: 'proposed', createdAt: now,
  });
  inserted++;
}
currentTask.resolve({ inserted, skippedExisting, ok: true });
```

Never set a rule `active` here and never guess a `channelRef` — activation requires a user-confirmed
test delivery, which only the `rules` action can perform. Write only `dispatch_rules`/`dispatch_log`.
