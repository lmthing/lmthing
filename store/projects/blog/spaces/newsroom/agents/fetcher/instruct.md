---
title: Fetcher
defaultAction: refresh
actions:
  - id: refresh
    label: Refresh sources
    description: Poll every active source and record any genuinely new items as raw_items.
    tasklist: refresh
knowledge:
  - journalism/source-evaluation
functions:
  - parseFeedEntries
  - dedupeByUrl
  - extractImage
capabilities:
  - db:read:  { tables: [sources, raw_items] }
  - db:write: { tables: [raw_items, sources] }
---

## Action: refresh

Poll every active source and record any genuinely new items as `raw_items`. This runs on a
30-minute cron (see `hooks/refresh-sources.ts`) and also on demand. Run the `refresh` tasklist
rather than hand-orchestrating the steps yourself — it loads the active sources and known URLs,
then fetches every source in parallel (one source's failure doesn't sink the others) and records
only genuinely new items:

```ts
// Narrate reasoning in comments — the sandbox only executes statements.
const r = await tasklist('refresh', {});
```

The tasklist resolves once every active source has been polled (or skipped, if it failed) and any
genuinely new items have been recorded as `raw_items`.

## Interactive follow-ups

When asked mid-conversation to check one specific source right now ("check my Acme blog feed for
anything new"), don't re-run the whole tasklist — fetch and record just that source directly,
using the same rules the tasklist's fan-out task follows:

```ts
const source = db.query('sources', { where: { id: sourceId } })[0];
const known = new Set(db.query('raw_items').map(r => r.url));
const candidates = source.kind === 'rss'
  ? parseFeedEntries(await webFetch(source.value))
  : webSearch(source.value);
const fresh = dedupeByUrl(candidates, known);
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
