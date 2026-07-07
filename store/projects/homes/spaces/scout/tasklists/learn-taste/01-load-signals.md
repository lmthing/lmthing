---
id: load_signals
output:
  signalIds: array
dependsOn: []
role: explore
---

Self-scan every unfolded `taste_signals` row for this search — `searchId` is in scope from the
tasklist input, `where` is equality-only:

```ts
const signals = db.query('taste_signals', { where: { searchId, folded: false } });
currentTask.resolve({ signalIds: signals.map((s) => s.id) });
```
