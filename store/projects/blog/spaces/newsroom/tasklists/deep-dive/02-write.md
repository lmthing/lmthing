---
id: write
dependsOn: [survey]
role: general
output:
  researchId: string
---

Turn `survey`'s findings into the final `research` row. `survey.pendingId` (from the self-query in
`survey`) is the id of a pending row to fill, or `''` for a free-form chat dive — insert a new row
in that case.

```ts
const body = survey.findings + '\n\n' + survey.sources.map(s => `- ${s}`).join('\n');
```

```ts
let id = survey.pendingId;
if (id) {
  db.update('research', { where: { id }, set: { body, status: 'ready' } });
} else {
  id = db.insert('research', { topic: survey.topic, body, status: 'ready' }).id;
}
currentTask.resolve({ researchId: id });
```

If `survey.findings` says plainly that nothing usable was found, write the row with
`status: 'error'` and a short honest note instead — do not launder a failed survey into a
confident-looking report.

Guardrails:

- Only cite sources actually fetched in `survey` — never add a source URL here that wasn't in
  `survey.sources`.
- `where` is equality-only across all `db.*` calls.
