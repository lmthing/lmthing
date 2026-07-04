---
id: gather
output:
  flagged: array
  symptoms: array
  research: array
dependsOn: []
role: general
---

Self-query the state a visit-prep brief needs — flagged labs, active symptoms, and ready research
write-ups. `where` is equality-only, so filter in memory beyond an exact match:

```ts
const flagged = db.query('lab_results', {}).filter((l) => l.flag !== 'normal');
const symptoms = db.query('symptoms', {}).filter((s) => !s.endedAt);
const research = db.query('research', { where: { status: 'ready' } });
currentTask.resolve({ flagged, symptoms, research });
```
