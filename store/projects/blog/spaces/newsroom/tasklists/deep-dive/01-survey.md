---
id: survey
role: explore
dependsOn: []
output:
  topic: string
  findings: string
  sources: array
  pendingId: string
---

Survey the topic with real search and fetches. **Self-query** the work rather than trusting a passed
id: prefer the oldest `research` row still `pending` (seeded by the `requestResearch` API), and fall
back to `query` (the chat topic) when there is none. `where` is equality-only, so filter/sort in
memory:

```ts
const pending = db.query('research')
  .filter(r => r.status === 'pending')
  .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))[0];
const topic = pending ? pending.topic : query;
const pendingId = pending ? pending.id : '';   // '' = no pending row; write will insert a fresh one
```

`webSearch` and `webFetch` are universal system globals (not space functions), so this task lists
no `functions:` — search first, then fetch a handful of the most promising results for real detail
rather than trusting search snippets alone:

```ts
const hits = webSearch(topic);
```

```ts
// Keep the fetch list short and genuinely worthwhile — two or three of the best hits, not
// everything indiscriminately.
const top = hits.slice(0, 3);
const pages = [];
for (const hit of top) {
  pages.push({ url: hit.url, page: await webFetch(hit.url) });
}
```

```ts
// Write the findings yourself, in your own words, grounded strictly in what `pages` actually
// said — never pad with plausible-sounding prior knowledge. If nothing usable came back, say so
// plainly in `findings` instead of inventing content.
const findings = '...'; // your synthesized findings, markdown, citing pages inline
currentTask.resolve({ topic, findings, sources: pages.map(p => p.url), pendingId });
```

Guardrail: only synthesize from `pages` — every claim in `findings` must trace back to one of the
fetched sources, or the survey should say plainly that it found nothing usable.
