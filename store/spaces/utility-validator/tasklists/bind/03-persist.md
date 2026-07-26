---
id: persist
dependsOn: [suggest]
role: general
capabilities: [db:read, db:write, db:schema]
functions: []
output:
  inserted: number
  skippedExisting: number
  ok: boolean
---

Persist the suggested rules into this space's own tables — idempotently, and all as proposals.

1. Ensure the own tables exist (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('validation_rules')) {
  db.createTable('validation_rules', {
    targetTable: 'string', column: 'string', kind: 'string',
    configJson: 'string', status: 'string', createdAt: 'string',
  });
}
```

```ts
if (!existing.includes('validation_violations')) {
  db.createTable('validation_violations', {
    ruleId: 'string', targetTable: 'string', rowId: 'string', reason: 'string',
    violationKey: 'string', status: 'string', createdAt: 'string',
  });
}
```

2. Insert each suggestion unless its (targetTable, column, kind) triple already has ANY rule row —
   whatever its status. Re-binding must never duplicate, and must never resurrect a rule the user
   disabled:

```ts
let inserted = 0, skippedExisting = 0;
const now = new Date().toISOString();
for (const r of suggest.rules) {
  const dupes = db.query('validation_rules', { where: { targetTable: r.targetTable, column: r.column, kind: r.kind } });
  if (dupes.length > 0) { skippedExisting++; continue; }
  db.insert('validation_rules', {
    targetTable: r.targetTable, column: r.column, kind: r.kind,
    configJson: JSON.stringify(r.config ?? {}),
    status: 'proposed',
    createdAt: now,
  });
  inserted++;
}
currentTask.resolve({ inserted, skippedExisting, ok: true });
```

**Every rule lands at `status: 'proposed'` — no exceptions, no confidence shortcut.** A rule becomes
`active` only through the inspector's `review` action, because an auto-activated rule would start
generating violations nobody agreed to. Write ONLY `validation_rules`/`validation_violations` — no
host-app table, ever. If `suggest.rules` is empty, resolve `{ inserted: 0, skippedExisting: 0,
ok: true }` — an app whose sample proves nothing is a valid outcome, not an error.
