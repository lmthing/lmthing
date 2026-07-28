---
id: apply
dependsOn: [load]
forEach: load.approved
optional: true
role: general
capabilities: [db:read, db:write]
functions: []
output:
  findingId: string
  applied: boolean
  reason: string?
---

Apply ONE approved finding (`item`) — its recorded patch, exactly as recorded, to exactly one row.

1. Parse the patch inside a `try`. A malformed `patchJson` is a dead end, never a guess:

```ts
let patch: any = null;
try { patch = item.patchJson ? JSON.parse(item.patchJson) : null; } catch { patch = undefined; }
```

```ts
if (patch === undefined || (patch !== null && typeof patch !== 'object')) {
  currentTask.resolve({ findingId: String(item.id), applied: false, reason: 'bad-patch' });
}
```

2. A finding with an empty `patchJson` (`duplicate`, `orphan`) carries no instruction. It is not a
   failure — it is simply not yours to resolve:

```ts
if (patch === null) {
  currentTask.resolve({
    findingId: String(item.id), applied: false,
    reason: 'no-patch finding — resolution is a human decision',
  });
}
```

3. Otherwise apply it verbatim — the recorded columns, the recorded values, one row by id:

```ts
db.update(item.targetTable, { where: { id: item.rowId }, set: patch });
currentTask.resolve({ findingId: String(item.id), applied: true });
```

Guardrails for this step, all hard:

- **Never** add, drop or adjust a key in `patch` — what the human approved is what gets written.
- **Never** touch a row other than `item.rowId`, or a table other than `item.targetTable`.
- **Never** delete anything: there is no delete on your surface, and a duplicate is resolved by a
  human, not by you.
- Never change any finding's `status` here — that's the next step's job, and only for the branches
  that actually succeeded.
