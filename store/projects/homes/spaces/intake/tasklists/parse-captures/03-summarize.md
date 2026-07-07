---
id: summarize
output:
  ok: boolean
  summarized: number
dependsOn: [extract_and_merge]
role: general
---

Write each capture's final summary from `extract_and_merge.results` (available as
`extract_and_merge.results`) in a **single loop** — skip anything already marked `error` upstream,
so this step never clobbers a terminal error state with a misleading success summary:

```ts
let summarized = 0;

for (const r of extract_and_merge.results) {
  const capture = db.query('raw_captures', { where: { id: r.captureId } })[0];
  if (!capture || capture.status === 'error') continue;

  const summary = r.merged > 0
    ? `Found ${r.found} listing${r.found === 1 ? '' : 's'}, merged ${r.merged} into existing record${r.merged === 1 ? '' : 's'}.`
    : `Found ${r.found} listing${r.found === 1 ? '' : 's'}.`;

  db.update('raw_captures', { where: { id: capture.id }, set: { status: 'parsed', summary: summary, listingsFound: r.found } });
  summarized++;
}

currentTask.resolve({ ok: true, summarized });
```
