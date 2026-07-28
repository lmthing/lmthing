---
id: record
dependsOn: [analyze]
role: general
capabilities: [db:read, db:write, db:schema]
functions:
  - computeFindingKey
output:
  recorded: number
  duplicates: number
  ok: boolean
---

Record the findings as `janitor_findings` rows — check-before-insert on `findingKey`, every time.
`analyze` is the collected fan-out output: one `{ table, findings }` per table (a skipped branch
contributes nothing).

1. Ensure the own table exists (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('janitor_findings')) {
  db.createTable('janitor_findings', {
    targetTable: 'string', rowId: 'string', kind: 'string', detail: 'string',
    patchJson: 'string', findingKey: 'string', status: 'string', createdAt: 'string',
  });
}
```

2. Insert every finding whose key is not already present:

```ts
const branches = (analyze ?? []).filter((b: any) => b && typeof b === 'object');
let recorded = 0, duplicates = 0;
const now = new Date().toISOString();
```

```ts
for (const b of branches) {
  for (const f of (b.findings ?? [])) {
    const findingKey = computeFindingKey(f.targetTable, f.rowId, f.kind, f.detail);
    const seen = db.query('janitor_findings', { where: { findingKey } });
    if (seen.length > 0) { duplicates++; continue; }
    db.insert('janitor_findings', { ...f, findingKey, status: 'proposed', createdAt: now });
    recorded++;
  }
}
currentTask.resolve({ recorded, duplicates, ok: true });
```

Insert findings exactly as computed — never edit a `detail`, a `patchJson`, or a `rowId`. Every
finding lands at `status: 'proposed'` and NOTHING else: this step must not write a single host-app
row, and must not pre-approve anything. Each insert auto-emits
`project/db.janitor_findings.insert` for downstream consumers. Zero findings is a valid outcome —
resolve `{ recorded: 0, duplicates: 0, ok: true }`.
