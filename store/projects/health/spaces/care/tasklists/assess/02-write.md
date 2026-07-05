---
id: write
output:
  written: number
dependsOn: [reason]
goal: true
---

Compose the plain-language markdown observation for each row `reason` assessed — always ending
with the mandatory "if you experience X, seek care now / call emergency services" escalation line
— then mark it ready:

```ts
let written = 0;
for (const item of reason.assessed) {
  const watchFor = item.symptom
    ? `Keep an eye on **${item.symptom.name}** (severity ${item.symptom.severity}${item.symptom.endedAt ? ', resolved' : ', ongoing'}).`
    : `Keep an eye on: ${item.question}.`;
  const body = [
    '# Triage observation',
    '',
    watchFor,
    '',
    '## What to watch for',
    '- Whether the symptom is getting worse, staying the same, or improving.',
    '- Whether any red-flag pattern from `care/triage` (e.g. chest pain with exertion, sudden severe',
    '  headache, one-sided weakness, trouble breathing) appears alongside it.',
    '',
    '## If this changes',
    'If you experience worsening pain, difficulty breathing, chest pain or pressure, sudden',
    'one-sided weakness or facial drooping, trouble speaking, or any other red-flag pattern, seek',
    'care now — call emergency services or go to the nearest emergency department.',
    '',
    '_This is an observation, not a diagnosis — always confirm with a clinician. Not medical advice._',
  ].join('\n');
  db.update('triage_assessments', { where: { id: item.id }, set: { body, urgency: item.urgency, status: 'ready' } });
  written++;
}
currentTask.resolve({ written });
```

This is the tasklist's goal task — its resolved `{ written }` count is what this tasklist reports
back to whatever triggered it. Each update is self-write-excluded from `hooks/triage-symptom.ts`
(insert-only), so the whole `assess` tasklist is bounded to one reconcile per run.
