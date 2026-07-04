---
id: compose
output:
  body: string
dependsOn: [gather]
goal: true
---

Compose the plain-language markdown brief from `gather`'s flagged labs, active symptoms, and ready
research, following `clinical/reference-ranges` and `clinical/triage` guidance for phrasing — and
close with a "## Questions to ask" list the user can bring to their visit.

```ts
const labLines = gather.flagged.map((l) => `- **${l.analyte}**: ${l.value} ${l.unit} (${l.flag}, reference range printed on the result)`);
const symptomLines = gather.symptoms.map((s) => `- **${s.name}** (severity ${s.severity}, since ${s.startedAt})`);
const researchLines = gather.research.map((r) => `- ${r.topic}`);
```

```ts
const questions = [];
if (gather.flagged.length > 0) questions.push('What do these flagged results mean for me specifically, given my history?');
if (gather.symptoms.length > 0) questions.push('Could this symptom be related to any of these results?');
if (gather.research.length > 0) questions.push('Does the recent literature I looked into change what you\'d recommend?');
questions.push('Is there anything from this summary that warrants a follow-up test or visit?');
```

```ts
const body = [
  '# Appointment prep brief',
  '',
  '## Flagged labs',
  labLines.length > 0 ? labLines.join('\n') : '_None flagged._',
  '',
  '## Active symptoms',
  symptomLines.length > 0 ? symptomLines.join('\n') : '_None ongoing._',
  '',
  '## Research on file',
  researchLines.length > 0 ? researchLines.join('\n') : '_None yet._',
  '',
  '## Questions to ask',
  questions.map((q) => `- ${q}`).join('\n'),
  '',
  '_This is not medical advice — for you and your clinician to discuss together._',
].join('\n');
currentTask.resolve({ body });
```

This is the tasklist's goal task — `body` is the markdown the interpreter's `prep` action writes
onto the pending `visit_briefs` row before marking it `ready`.
