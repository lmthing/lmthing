---
id: survey
role: general
dependsOn: []
output:
  topic: string
  findings: string
  sources: array
  briefingId: string
  articleIds: array
---

Your **first statement** is the exact self-query below. The pending briefing lives in the
**`briefings` database table** — read it with `db.query('briefings')`. Do **not** use `todoRead` or
any todo/task API; there are no todos here, the work is a db row. The invocation message (`query`) is
a meaningless hook trigger string, **not** the topic — the real topic is the pending briefing's
`topic` column. Only fall back to `query` as the topic when there is genuinely **no** pending row
(the free-form chat case). `where` is equality-only, so filter/sort in memory:

```ts
const pending = db.query('briefings')
  .filter(b => b.status === 'pending')
  .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))[0];
const topic = pending ? pending.topic : query;
const briefingId = pending ? pending.id : ''; // '' = no pending row (a free-form chat dive)
```

`webSearch` and `webFetch` are universal system globals (not space functions), so this task lists
no `functions:`. Do **one** search on the real `topic`, then fetch just the **two** most promising
results for real detail — keep the fetch list short so the survey completes well inside its budget:

```ts
const hits = webSearch(topic);
```

```ts
// Two of the best hits, not everything indiscriminately — a briefing survey has a bounded budget.
const top = hits.slice(0, 2);
const pages = [];
for (const hit of top) {
  pages.push({ url: hit.url, page: await webFetch(hit.url) });
}
```

Also pull in relevant existing `articles` — a briefing should draw on the feed as well as the open
web, not just a fresh search. Match loosely on the topic's words against title/summary/tags (`where`
is equality-only, so this filtering happens in memory), and — when the pending briefing is scoped
to a collection — include that collection's members too:

```ts
const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
const feedMatches = db.query('articles')
  .filter(a => topicWords.some(w => `${a.title} ${a.summary}`.toLowerCase().includes(w) || (a.tags ?? []).includes(w)))
  .slice(0, 10);

let collectionArticles: any[] = [];
if (pending?.collectionId) {
  const items = db.query('collection_items', { where: { collectionId: pending.collectionId } });
  collectionArticles = items
    .map(i => db.query('articles', { where: { id: i.articleId } })[0])
    .filter(Boolean);
}

const articleIds = [...new Set([...feedMatches.map(a => a.id), ...collectionArticles.map(a => a.id)])];
```

```ts
// Write the findings yourself, in your own words, grounded strictly in what `pages` and the
// matched feed articles actually said — never pad with plausible-sounding prior knowledge. If
// nothing usable came back from either the web or the feed, say so plainly in `findings` instead
// of inventing content.
const findings = '...'; // your synthesized findings, markdown, citing pages + feed articles inline
currentTask.resolve({ topic, findings, sources: pages.map(p => p.url), briefingId, articleIds });
```

Guardrail: only synthesize from `pages` and the matched `articles` — every claim in `findings` must
trace back to one of the fetched sources or a real feed article, or the survey should say plainly
that it found nothing usable. Keep the briefing genuinely multi-source, not a single-search rehash.
