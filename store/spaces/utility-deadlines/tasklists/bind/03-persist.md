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

Persist the proposed watchers into this space's own tables — idempotently.

1. Ensure the own tables exist (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('deadline_watchers')) {
  db.createTable('deadline_watchers', {
    targetTable: 'string', targetColumn: 'string', labelColumn: 'string',
    leadDays: 'number', confidence: 'number', status: 'string', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('deadline_alerts')) {
  db.createTable('deadline_alerts', {
    watcherId: 'string', targetTable: 'string', rowId: 'string', dueAt: 'string',
    daysLeft: 'number', label: 'string', dedupeKey: 'string', status: 'string', createdAt: 'string',
  });
}
```

2. Insert each proposed watcher unless its (targetTable, targetColumn) pair already has ANY
   watcher row — whatever its status. Re-binding must never duplicate, and must never resurrect a
   watcher the user disabled:

```ts
let inserted = 0, skippedExisting = 0;
const now = new Date().toISOString();
for (const w of propose.watchers) {
  const dupes = db.query('deadline_watchers', { where: { targetTable: w.targetTable, targetColumn: w.targetColumn } });
  if (dupes.length > 0) { skippedExisting++; continue; }
  db.insert('deadline_watchers', { ...w, createdAt: now });
  inserted++;
}
currentTask.resolve({ inserted, skippedExisting, ok: true });
```

Write ONLY `deadline_watchers`/`deadline_alerts` — no host-app table, ever (the grant enforces
this; don't fight the typecheck). If `propose.watchers` is empty, resolve `{ inserted: 0,
skippedExisting: 0, ok: true }` — an app with no date columns is a valid outcome, not an error.
