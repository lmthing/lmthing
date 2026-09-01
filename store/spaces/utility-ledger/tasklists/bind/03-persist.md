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

Persist the proposed bindings into this space's own tables — idempotently.

1. Ensure the own tables exist (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('ledger_bindings')) {
  db.createTable('ledger_bindings', {
    targetTable: 'string', amountColumn: 'string', dateColumn: 'string', categoryColumn: 'string',
    direction: 'string', status: 'string', confidence: 'number', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('ledger_budgets')) {
  db.createTable('ledger_budgets', {
    bindingId: 'string', monthlyLimit: 'number', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('ledger_reports')) {
  db.createTable('ledger_reports', {
    bindingId: 'string', periodStart: 'string', periodEnd: 'string', total: 'number',
    count: 'number', byCategoryJson: 'string', overBudget: 'boolean', reportKey: 'string',
    status: 'string', createdAt: 'string',
  });
}
```

All three are created here, even though only `ledger_bindings` is written in this pass — `close`
and `budgets` must never have to create a table mid-flight.

2. Insert each proposed binding unless its (targetTable, amountColumn) pair already has ANY binding
   row — whatever its status. Re-binding must never duplicate, and must never resurrect a binding
   the user disabled:

```ts
let inserted = 0, skippedExisting = 0;
const now = new Date().toISOString();
for (const b of propose.bindings) {
  const dupes = db.query('ledger_bindings', { where: { targetTable: b.targetTable, amountColumn: b.amountColumn } });
  if (dupes.length > 0) { skippedExisting++; continue; }
  db.insert('ledger_bindings', { ...b, createdAt: now });
  inserted++;
}
currentTask.resolve({ inserted, skippedExisting, ok: true });
```

Write ONLY `ledger_bindings`/`ledger_budgets`/`ledger_reports` — no host-app table, ever (the grant
enforces this; don't fight the typecheck). If `propose.bindings` is empty, resolve `{ inserted: 0,
skippedExisting: 0, ok: true }` — an app with no money columns is a valid outcome, not an error.
