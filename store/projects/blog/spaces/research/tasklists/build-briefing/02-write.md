---
id: write
role: general
dependsOn: [survey]
functions:
  - formatBriefing
output:
  briefingId: string
---

Turn `survey`'s findings into the final `briefings` row. `survey.briefingId` (from the self-query in
`survey`) is the id of the pending row to fill, or `''` for a free-form chat dive.

First decide whether the survey actually produced something usable — a real topic plus non-empty
findings backed by at least one source or feed article:

```ts
const ok = !!survey.topic
  && !!survey.findings && survey.findings.trim().length > 40
  && ((survey.sources?.length ?? 0) > 0 || (survey.articleIds?.length ?? 0) > 0);
```

```ts
const { title, body } = formatBriefing(survey.topic, survey.findings, survey.sources);
```

If there **is** a pending row (`survey.briefingId`), always fill **that** row — update it to `ready`
when the survey succeeded, or to `error` with the honest findings note when it didn't. **Never**
insert a second briefing on the hook path:

```ts
let id = survey.briefingId;
if (id) {
  db.update('briefings', {
    where: { id },
    set: ok
      ? { title, body, status: 'ready', sourceCount: survey.sources.length }
      : { body: survey.findings || 'No usable sources were found for this briefing.', status: 'error' },
  });
}
```

Only the free-form chat case (no pending row) may insert — and only when the survey genuinely
succeeded. If there is no pending row **and** nothing usable was found, do **not** fabricate a row:

```ts
if (!id && ok) {
  id = db.insert('briefings', {
    title, topic: survey.topic, body, status: 'ready', sourceCount: survey.sources.length,
  }).id;
}
currentTask.resolve({ briefingId: id });
```

Never launder a failed survey into a confident-looking briefing, and never invent a topic — the
topic must be the pending row's or a real chat request.

Guardrails:

- Only cite sources actually fetched in `survey` — never add a source URL here that wasn't in
  `survey.sources`, and never claim an `articles` row was drawn on that wasn't in
  `survey.articleIds`.
- `where` is equality-only across all `db.*` calls.
