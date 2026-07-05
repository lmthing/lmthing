---
id: reason
output:
  assessed: array
dependsOn: []
role: general
---

Self-query the pending triage assessments and, for each, settle on a conservative urgency by
reasoning **only** over the injected `care/triage` knowledge (`red-flags.md`,
`when-to-escalate.md`, `urgency-levels.md`) — never the open web, this space has no web access by
design. `where` is equality-only, so filter/sort in memory beyond an exact match:

```ts
const pending = db.query('triage_assessments', { where: { status: 'pending' } });
const assessed = [];
for (const row of pending) {
  const symptom = row.symptomId ? db.query('symptoms', { where: { id: row.symptomId } })[0] : null;
  // Weigh row.question / symptom.name+severity against care/triage's red-flags.md and
  // when-to-escalate.md. A red-flag pattern → 'emergency'; a genuine but non-red-flag change worth
  // a clinician's eyes soon → 'urgent'; a mild/ambiguous or resolving finding with no red flag →
  // 'routine'; a clearly minor, well-understood symptom → 'self_care'. When two buckets both seem
  // plausible, pick the higher (more urgent) one.
  const urgency = /* the level this row's reasoning concluded */ 'routine';
  assessed.push({ id: row.id, question: row.question, symptom, urgency });
}
currentTask.resolve({ assessed });
```

(Your `care/triage` knowledge is already in context — do **not** call `loadKnowledge`; just apply
it above. The `'routine'` in the snippet is only this doc's illustrative placeholder — the actual
value must be the level each row's own reasoning concludes, never a fixed default.)
