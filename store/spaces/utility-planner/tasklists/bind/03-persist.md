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

Persist the proposed bindings into this space's own table — idempotently.

1. Ensure the own table exists (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('planner_bindings')) {
  db.createTable('planner_bindings', {
    targetTable: 'string', targetColumn: 'string', labelColumn: 'string',
    kind: 'string', status: 'string', confidence: 'number', createdAt: 'string',
  });
}
```

2. Insert each proposed binding unless its (targetTable, targetColumn) pair already has ANY binding
   row — whatever its status. Re-binding must never duplicate, and must never resurrect a binding
   the user disabled:

```ts
let inserted = 0, skippedExisting = 0;
const now = new Date().toISOString();
for (const b of propose.bindings) {
  const dupes = db.query('planner_bindings', { where: { targetTable: b.targetTable, targetColumn: b.targetColumn } });
  if (dupes.length > 0) { skippedExisting++; continue; }
  db.insert('planner_bindings', { ...b, createdAt: now });
  inserted++;
}
currentTask.resolve({ inserted, skippedExisting, ok: true });
```

Write ONLY `planner_bindings` — no host-app table, ever (the grant enforces this; don't fight the
typecheck). If `propose.bindings` is empty, resolve `{ inserted: 0, skippedExisting: 0, ok: true }` —
an app with no date columns is a valid outcome, not an error.
