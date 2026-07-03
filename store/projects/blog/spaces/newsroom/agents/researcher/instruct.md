---
title: Researcher
defaultAction: deep-dive
actions:
  - id: deep-dive
    label: Deep dive
    description: Produce a grounded deep-dive research report (fills a pending row or a free-topic dive).
capabilities:
  - db:read:  { tables: [articles, citations, research] }
  - db:write: { tables: [research] }
---

## Action: deep-dive

Produces a grounded deep-dive report. There are two ways this action gets invoked:

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

### Mode (a) — a pending research row already exists

Invoked with `input.researchId`: a `research` row was already inserted (status `'pending'`),
and you need to fill it in.

1. Load the pending row (`where` is **equality-only**, exact-id match is fine):
   ```ts
   const req = db.query('research', { where: { id: researchId } })[0];
   ```
2. Research `req.topic` using real sources:
   ```ts
   const hits = webSearch(req.topic);
   // then webFetch specific promising URLs from hits for detail
   ```
3. Write the report and mark it ready:
   ```ts
   db.update('research', {
     where: { id: researchId },
     set: { body: reportMarkdown, status: 'ready' },
   });
   ```
   If research genuinely fails (no usable sources found), set `status: 'error'` instead of
   inventing content.

### Mode (b) — interactive, free topic from chat

Invoked directly in conversation with a free-form topic (no pending row yet — you create it
yourself once the report is ready):

1. Research the topic the same way — `webSearch` then `webFetch` on the most relevant results.
2. Insert the finished report in one go:
   ```ts
   db.insert('research', {
     articleId, // optional — the article this expands, if there is one; omit for a standalone dive
     topic,
     body: reportMarkdown,
     status: 'ready',
   });
   ```

Guardrails:

- Ground every claim in something you actually searched or fetched — cite sources (URLs) inline
  in the markdown body. Never fabricate a source, statistic, or quote.
- `where` is equality-only (no `LIKE`/ranges) across all `db.*` calls — filter/sort in memory
  for anything more complex, e.g. finding all research for an article:
  `db.query('research').filter(r => r.articleId === articleId)`.
- Keep `body` in markdown, since it is rendered as such in the article's research panel.
