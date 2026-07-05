---
id: research
output:
  rowId: string
  otherName: string
  severity: string
  summary: string
  sources: array
dependsOn: [load-pending]
forEach: load-pending.pending
role: general
---

Fans out over each pending interaction produced by `load-pending`. `item` is one `{ row, medication
}` pair — research this specific pairing in the literature. No `functions:` key on this task:
omitting it keeps the universal `webSearch`/`webFetch` globals available, which this task needs to
find reputable sources.

```ts
const { row, medication } = item;
// Check preferred trusted sources before searching the open web.
const sources = db.query('sources', {});
```

```ts
const results = await webSearch(
  `${medication ? medication.name : 'this medication'} interaction ${row.otherName ?? ''}`.trim(),
);
// Fetch the most relevant, reputable-looking results for detail as needed with webFetch(...).
```

```ts
// Write a concise, cited summary in your own words — never paste raw fetched page content.
// If web search is unavailable, still resolve a careful, general, well-hedged summary from what
// you know — and say so in the summary — rather than leaving this branch empty.
currentTask.resolve({
  rowId: row.id,
  otherName: row.otherName || 'an interacting substance found in the literature',
  severity: 'unknown', // set 'minor' | 'moderate' | 'severe' | 'unknown' from what the sources actually say
  summary: '...finding, synthesized in your own words, distilled from the sources above...',
  sources: [{ title: '...', url: 'https://example.org' }],
});
```
