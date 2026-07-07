---
id: scan_pending
output:
  captureIds: array
dependsOn: []
role: explore
---

Self-scan every `raw_captures` row still `pending` (`where` is equality-only):

```ts
const pending = db.query('raw_captures', { where: { status: 'pending' } });
currentTask.resolve({ captureIds: pending.map((c) => c.id) });
```
