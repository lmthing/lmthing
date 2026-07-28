---
id: apply
dependsOn: [load]
forEach: load.approved
optional: true
role: general
capabilities: [db:read, db:write]
functions:
  - validateProposedValue
output:
  taskId: string
  applied: boolean
  reason: string
---

Apply ONE approved task (`item`) to the host app — the single column, of the single row, and only
if it is still blank.

1. Re-validate the value. It was validated when it was proposed; validate it again now — defense in
   depth, because the row may have been approved days ago and nothing else re-checks it:

```ts
const check = validateProposedValue(item.column, item.proposedValue);
```

```ts
if (check.ok !== true) {
  currentTask.resolve({ taskId: String(item.id), applied: false, reason: `revalidation failed: ${check.reason}` });
}
```

2. Confirm the target row still exists:

```ts
const target = db.query(item.targetTable, { where: { id: item.rowId } });
```

```ts
if (target.length === 0) {
  currentTask.resolve({ taskId: String(item.id), applied: false, reason: 'row-missing' });
}
```

3. Confirm the cell is **still empty**. Somebody may have filled it in while the proposal sat in
   review — their value wins, always:

```ts
const current = target[0][item.column];
const stillEmpty = current === null || current === undefined || (typeof current === 'string' && current.trim() === '');
```

```ts
if (!stillEmpty) {
  currentTask.resolve({ taskId: String(item.id), applied: false, reason: 'no-longer-empty' });
}
```

4. Patch exactly one column:

```ts
db.update(item.targetTable, { where: { id: item.rowId }, set: { [item.column]: check.normalized } });
currentTask.resolve({ taskId: String(item.id), applied: true, reason: '' });
```

Write the normalized value from the validator, never the raw string. Set ONE key in `set` — the
researched column. Never touch another column, another row, or another table, and never delete
anything: a conflict resolves as `applied: false`, it never resolves by overwriting.
