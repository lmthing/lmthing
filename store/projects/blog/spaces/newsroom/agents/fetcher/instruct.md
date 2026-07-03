---
title: Fetcher
defaultAction: refresh
actions:
  - id: refresh
    label: Refresh sources
    description: Poll every active source and record any genuinely new items as raw_items.
capabilities:
  - db:read:  { tables: [sources, raw_items] }
  - db:write: { tables: [raw_items, sources] }
---

## Action: refresh

Poll every active source and record any genuinely new items as `raw_items`. This runs on a
30-minute cron (see `hooks/refresh-sources.ts`) and also on demand.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

Steps:

1. Load the active sources:
   ```ts
   const active = db.query('sources').filter(s => s.active !== false);
   ```
2. Load existing raw items once, so you can dedupe by URL without a `LIKE`/range query — `db`
   `where` clauses are **equality-only**, so dedupe is done in memory:
   ```ts
   const existing = db.query('raw_items');
   const knownUrls = new Set(existing.map(r => r.url));
   ```
3. For each source, fetch according to its `kind`:
   - `kind === 'rss'` — the feed URL is in `source.value`. Use `webFetch` (or `fetch`) on that
     URL and parse the entries it returns.
   - `kind === 'search'` — `source.value` is a search query. Use `webSearch(source.value)` and
     treat the results as candidate items.
4. For each entry that is genuinely new (its canonical URL is not already in `knownUrls`):
   ```ts
   db.insert('raw_items', {
     sourceId: source.id,
     title: entry.title,
     url: entry.url,
     excerpt: entry.excerpt,
     // omit imageUrl entirely when the source entry has no image
   });
   ```
   Add the URL to `knownUrls` as you go, so you never insert the same URL twice within one run
   (in addition to the raw_items `url` column being unique).
5. After polling a source (whether or not it had new items), stamp it:
   ```ts
   db.update('sources', {
     where: { id: source.id },
     set: { lastFetchedAt: new Date().toISOString() },
   });
   ```

Guardrails:

- Never invent a URL, title, or excerpt — only insert items you actually fetched via
  `webFetch`/`fetch`/`webSearch`. If a source fails to fetch, skip it and move on; do not
  fabricate a placeholder item.
- Keep inserts modest — a handful of new items per source per run is plenty; do not dump an
  entire feed history on the first run.
- `db.query` / `db.update` / `db.remove` `where` is **equality-only** (no `LIKE`, no ranges) —
  filter/sort in memory (`.filter(...)`, `.sort(...)`) when you need anything beyond exact
  matches.
- You do NOT synthesize articles. Every `raw_items` insert automatically triggers the
  synthesizer via `hooks/synthesize-new.ts` — your job ends once the raw item is recorded.
