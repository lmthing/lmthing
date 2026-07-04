---
id: fetch_each
dependsOn: [load_sources]
forEach: load_sources.sourceIds
optional: true
role: general
functions:
  # A task-level `functions:` list is an ALLOWLIST that gates system functions
  # too — webFetch/webSearch/fetch must be listed here or they are stripped from
  # the fork and the fetch fails.
  - parseFeedEntries
  - dedupeByUrl
  - extractImage
  - webFetch
  - webSearch
  - fetch
output:
  ok: boolean
---

Fans out over each source id produced by `load_sources`. `item` is one source id — load the
source row, fetch it according to its `kind`, dedupe against the URLs already known, and insert
only genuinely new `raw_items`.

```ts
const source = db.query('sources', { where: { id: item } })[0];
```

`kind === 'rss'` — `source.value` is the feed URL; fetch the raw XML/Atom body and parse entries
out of it. `kind === 'search'` — `source.value` is a search query; treat the results as candidate
items directly:

```ts
const candidates = source.kind === 'rss'
  ? parseFeedEntries(await webFetch(source.value))
  : webSearch(source.value);
```

Dedupe against both the URLs already in the database and anything already inserted earlier in
this same fan-out (`load_sources.knownUrls` is the same array shared by every parallel branch, so
this only protects against re-processing this one source's own duplicates — the `raw_items.url`
unique constraint is the real backstop across branches):

```ts
const fresh = dedupeByUrl(candidates, new Set(load_sources.knownUrls));
```

```ts
for (const entry of fresh) {
  db.insert('raw_items', {
    sourceId: source.id,
    title: entry.title,
    url: entry.url,
    excerpt: entry.excerpt,
    imageUrl: extractImage(entry.excerpt),
    // extractImage resolves to undefined when nothing looks like an image — never invent one
  });
}
```

```ts
db.update('sources', {
  where: { id: source.id },
  set: { lastFetchedAt: new Date().toISOString() },
});
currentTask.resolve({ ok: true });
```

This task is `optional` — one flaky source (a dead feed URL, a search that turns up nothing) must
not sink the whole refresh run.

Guardrails:

- Never invent a URL, title, or excerpt — only insert items that came back from an actual
  `webFetch`/`webSearch` call. If a source fails to fetch, resolve `{ ok: true }` anyway (nothing
  to insert) rather than fabricating a placeholder item.
- Keep inserts modest — a handful of new items per source per run is plenty; do not dump an
  entire feed's history on the first run.
- You do NOT synthesize articles here. Every `raw_items` insert automatically triggers the
  synthesizer via `hooks/synthesize-new.ts`.
