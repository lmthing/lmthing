---
id: scan
dependsOn: [load]
forEach: load.tablesWithRules
optional: true
role: explore
functions:
  - checkRule
  - computeViolationKey
output:
  targetTable: string
  violations: array
  scanned: boolean
---

Scan ONE table (`item` is `{ targetTable, rules }`) — read its rows once, evaluate every rule
against every row, and hand the violations (with their keys pre-computed) to the recording step.
Read-only here.

```ts
const tableNames = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!tableNames.includes(item.targetTable)) {
  // Schema drifted since bind. `scanned: false` is load-bearing: the record step must NOT
  // auto-resolve violations for a table it never re-checked.
  currentTask.resolve({ targetTable: item.targetTable, violations: [], scanned: false });
}
```

```ts
const rows = db.query(item.targetTable);
```

For every `reference` rule, load the referenced table's ids ONCE — `checkRule` performs no I/O and
expects them passed in:

```ts
const refIds: Record<string, any[]> = {};
for (const r of item.rules) {
  if (r.kind !== 'reference') continue;
  const parent = r.config?.table;
  if (!parent || !tableNames.includes(parent) || refIds[r.id]) continue;
  refIds[r.id] = db.query(parent).map((p: any) => p.id);
}
```

```ts
const violations: any[] = [];
for (const row of rows) {
  for (const r of item.rules) {
    const res = checkRule(r, row, refIds[r.id] ?? null);
    if (res.ok !== false) continue; // ok:true — including every `skipped` result — is silence
    violations.push({
      ruleId: r.id,
      rowId: String(row.id),
      reason: res.reason,
      violationKey: computeViolationKey(r.id, item.targetTable, row.id),
    });
  }
}
currentTask.resolve({ targetTable: item.targetTable, violations, scanned: true });
```

`where` is equality-only — you loaded ALL rows deliberately; `checkRule` does the judging. Never
re-implement a rule's logic inline, never rewrite a returned `reason`, and never turn a `skipped`
result into a violation: an unrunnable rule is a broken rule, not a broken row.
