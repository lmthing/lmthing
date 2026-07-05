---
id: load-pending
output:
  pending: array
dependsOn: []
role: general
---

Self-query the actual work rather than trusting `trigger` — collect every `interactions` row still
`pending`, alongside the medication each one concerns, for the research fan-out that follows:

```ts
const rows = db.query('interactions', { where: { status: 'pending' } });
const pending = rows.map((row) => ({
  row,
  medication: db.query('medications', { where: { id: row.medicationId } })[0],
}));
currentTask.resolve({ pending });
```
