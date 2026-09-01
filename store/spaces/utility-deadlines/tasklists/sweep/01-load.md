---
id: load
dependsOn: []
role: explore
functions: []
output:
  watchers: array
  nowIso: string
---

Load the work — active watchers only — and fix the sweep's reference instant ONCE, so every branch
of the fan-out computes against the same clock:

```ts
const watchers = db.query('deadline_watchers', { where: { status: 'active' } });
currentTask.resolve({ watchers, nowIso: new Date().toISOString() });
```

If the table doesn't exist yet (bind never ran), resolve `{ watchers: [], nowIso: new Date().toISOString() }`
— an unswept project is a valid state, not an error.
