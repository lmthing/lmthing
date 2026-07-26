---
id: load
dependsOn: []
role: explore
functions: []
output:
  items: array
  rules: array
  itemCount: number
---

Load the work and the policy. Rules are sorted by `createdAt` so evaluation order is a deliberate,
inspectable property — `matchIntakeRule` takes the first match in the order you hand it:

```ts
const items = db.query('intake_items', { where: { status: 'pending' } });
const rules = db.query('intake_rules', { where: { status: 'active' } })
  .sort((a: any, b: any) => String(a.createdAt).localeCompare(String(b.createdAt)));
currentTask.resolve({ items, rules, itemCount: items.length });
```

If the tables do not exist yet, resolve `{ items: [], rules: [], itemCount: 0 }` — an inbox nobody
has wired up yet is a valid state, not an error.
