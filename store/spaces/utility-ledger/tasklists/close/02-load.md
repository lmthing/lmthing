---
id: load
condition: "gate.shouldRun == true"
dependsOn: [gate]
role: explore
functions: []
output:
  bindings: array
  budgets: array
---

Load the work — active bindings and every budget row. This step only runs on a closing day (the
condition reads `gate.shouldRun`); on any other day it is skipped and costs nothing.

```ts
const bindings = db.query('ledger_bindings', { where: { status: 'active' } });
const budgets = db.query('ledger_budgets');
currentTask.resolve({ bindings, budgets });
```

Load ALL budgets rather than one per binding: `where` is equality-only and the set is tiny, so the
match happens in memory at record time.

If the tables don't exist yet (bind never ran), resolve `{ bindings: [], budgets: [] }` — an
unbound project is a valid state, not an error.
