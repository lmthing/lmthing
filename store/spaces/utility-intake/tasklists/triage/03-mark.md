---
id: mark
dependsOn: [route]
role: general
capabilities: [db:read, db:write]
functions: []
output:
  routed: number
  unrouted: number
  ok: boolean
---

Record each item's outcome. `route` is the collected fan-out — one branch per item (a branch that
failed contributes nothing, and its item simply stays `pending` for the next pass):

```ts
const branches = (route ?? []).filter((b: any) => b && typeof b === 'object' && b.itemId);
let routed = 0, unrouted = 0;
for (const b of branches) {
  if (b.routed === true) {
    db.update('intake_items', {
      where: { id: b.itemId },
      set: { status: 'routed', routedTable: b.targetTable, routedRowId: b.newRowId },
    });
    routed++;
  } else {
    db.update('intake_items', { where: { id: b.itemId }, set: { status: 'unrouted' } });
    unrouted++;
  }
}
currentTask.resolve({ routed, unrouted, ok: true });
```

These are UPDATES to `intake_items`, and the space's hook fires on INSERT only — so marking never
re-triggers triage. An item left `pending` because its branch failed is deliberate: the next pass
retries it rather than silently burying it as `unrouted`.
