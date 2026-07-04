---
id: gather
output:
  labs: array
  symptoms: array
  metrics: array
dependsOn: []
role: general
---

Self-query the actual state rather than trusting `trigger` — collect the flagged lab results,
active (unresolved) symptoms, and all metrics for the trend pass that follows. `where` is
equality-only, so filter in memory beyond an exact match:

```ts
const labs = db.query('lab_results', {}).filter((l) => l.flag !== 'normal');
const symptoms = db.query('symptoms', {}).filter((s) => !s.endedAt);
const metrics = db.query('metrics', {});
currentTask.resolve({ labs, symptoms, metrics });
```
