---
id: load-goals
output:
  goals: array
dependsOn: []
role: general
---

Load every active goal — the set this whole check-in evaluates. `where` is equality-only, which is
exactly what an exact `status` match needs:

```ts
const goals = db.query('goals', { where: { status: 'active' } });
currentTask.resolve({ goals });
```
