---
id: load
dependsOn: []
role: explore
functions: []
output:
  bindings: array
  nowIso: string
---

Load the work — active bindings only — and fix the sweep's reference instant ONCE, so every branch
of the fan-out stamps the same `sweepAt` and therefore the same dedupe day:

```ts
const bindings = db.query('audit_bindings', { where: { status: 'active' } });
currentTask.resolve({ bindings, nowIso: new Date().toISOString() });
```

If the table doesn't exist yet (bind never ran), resolve `{ bindings: [], nowIso: new Date().toISOString() }`
— an unbound project is a valid state, not an error.

Do not re-read the clock later. A sweep that straddles midnight with two different instants would
split one pass across two dedupe days and could log the same change twice.
