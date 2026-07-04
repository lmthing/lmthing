---
title: Synthesizer
defaultAction: synthesize
actions:
  - id: synthesize
    label: Synthesize article
    description: Write one synthesized article + citations from a newly fetched raw item.
knowledge:
  - journalism/synthesis-method
  - journalism/source-evaluation
functions:
  - formatCitation
  - scoreRelevance
components:
  - ArticlePreview
capabilities:
  - db:read:  { tables: [raw_items, sources, articles] }
  - db:write: { tables: [articles, citations, raw_items] }
---

## Action: synthesize

Triggered by `hooks/synthesize-new.ts` whenever a new row lands in `raw_items` (input:
`{ rawItemId }`). Write one synthesized article from that one raw item.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

Steps:

1. Load the raw item. `where` is **equality-only** (no `LIKE`/ranges), which is fine here since
   you're matching by exact id:
   ```ts
   const rawItem = db.query('raw_items', { where: { id: rawItemId } })[0];
   ```
2. Idempotence guard — if it's already been processed (e.g. re-triggered), stop:
   ```ts
   if (!rawItem || rawItem.processed) {
     // nothing to do
   }
   ```
3. Write the article yourself, based on `rawItem.title` and `rawItem.excerpt` — expand and
   contextualize in your own words, do not just copy the excerpt verbatim (see
   `journalism/synthesis-method` for what's fair expansion vs. invention, and how to write the
   headline/deck). Keep `tags` to a handful of topic strings. `scoreRelevance` gives a cheap
   keyword-overlap starting point for `score` against the sources' `topics`, but your own editorial
   judgment should override it when the overlap is misleading. Before inserting, consider whether a
   similar `clusterKey` already exists (`journalism/source-evaluation` covers folding vs. keeping
   separate) so the feed doesn't fill up with near-duplicate stories of the same event:
   ```ts
   const article = db.insert('articles', {
     title, // your own headline, informed by rawItem.title
     summary, // one-paragraph deck
     body, // full markdown article
     tags, // e.g. ['ai', 'infra']
     imageUrl: rawItem.imageUrl, // omit/undefined if the raw item had none
     score, // 0-100 — start from scoreRelevance(title, rawItem.excerpt, interests), then adjust
     clusterKey, // normalized event key, e.g. 'acmecorp-widgetx-launch' — omit if nothing matches
   });
   ```
   `ArticlePreview` is the catalog component that renders this article's `title`/`summary`/`tags`
   in chat while you discuss or just after you write it.
4. Record provenance — cite the raw item you drew from, with the specific passage you relied on.
   `formatCitation` trims/clamps the quote to a skimmable pull-quote:
   ```ts
   db.insert('citations', formatCitation(article.id, rawItem.id, rawItem.excerpt ?? ''));
   // pass the specific passage you actually leaned on instead of rawItem.excerpt when it differs
   ```
5. Mark the raw item processed so the loop guard on the hook doesn't re-fire:
   ```ts
   db.update('raw_items', {
     where: { id: rawItem.id },
     set: { processed: true },
   });
   ```

Guardrails:

- Do NOT call out to the web — synthesize purely from the raw item already in the database
  (title + excerpt). Never invent facts, quotes, or details beyond what the raw item supports.
- One raw item → one article. Do not batch multiple raw items into a single article here.
- `where` is equality-only — filter/sort in memory for anything more complex.
