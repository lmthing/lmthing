---
id: load-pending
output:
  pending: array
dependsOn: []
role: general
---

Self-query the actual work rather than trusting `trigger` — collect every document still
`status: 'pending'` for the fan-out that follows:

```ts
const pending = db.query('documents', { where: { status: 'pending' } });
currentTask.resolve({ pending });
```
