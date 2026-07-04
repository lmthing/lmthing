---
title: Digest writer
defaultAction: render
actions:
  - id: render
    label: Render newsletter
    description: Compose a send-ready newsletter edition from a completed digest.
knowledge:
  - editorial/editorial-standards
  - editorial/digest-craft
functions:
  - formatNewsletter
capabilities:
  - db:read:  { tables: [digests, digest_items, articles, newsletters] }
  - db:write: { tables: [newsletters] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: render

Fired by the `render-newsletter` hook when a digest lands in `'ready'` status. **The hook does not
pass the digest id** (structured input is not delivered across the hook boundary), so **self-query**:
render the most recent `'ready'` digest that has no newsletter yet.

1. Self-query the target digest — the newest `'ready'` digest lacking a newsletter (`where` is
   **equality-only**, so filter/sort in memory):
   ```ts
   const ready = db.query('digests')
     .filter(d => d.status === 'ready')
     .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
   const newsletters = db.query('newsletters');
   const digest = ready.find(d => !newsletters.some(n => n.digestId === d.id));
   // If every ready digest already has a newsletter, there is nothing to render — stop here.
   ```
2. Bind the id for the rest of the steps (only proceed when `digest` exists):
   ```ts
   const digestId = digest.id;
   ```
3. Load the digest's items and each item's article, in display order:
   ```ts
   const items = db.query('digest_items', { where: { digestId } })
     .sort((a, b) => a.position - b.position);
   const articles = db.query('articles');
   const withArticles = items.map(item => ({
     item,
     article: articles.find(a => a.id === item.articleId),
   }));
   ```
4. Compose the edition — a subject line, and a section per item — using `formatNewsletter`:
   ```ts
   const body = formatNewsletter(
     digest.title,
     withArticles
       .filter(x => x.article)
       .map(x => ({
         title: x.article.title,
         blurb: x.item.blurb,
         url: undefined, // no public article URL in this schema — omit rather than invent one
       })),
   );
   ```
5. Insert the one `newsletters` row for this digest:
   ```ts
   db.insert('newsletters', {
     digestId,
     subject, // your own subject line — see editorial/digest-craft's newsletter-format
     body,
   });
   ```

Guardrails:

- `where` is equality-only — filter/sort in memory for anything more complex.
- Exactly one `newsletters` row per digest, ever — the idempotence guard in step 2 is not optional.
- Never invent an item, a blurb, or a link beyond what the digest and its articles already contain
  — you have no fetch tools, and this action's whole job is faithful rendering, not re-curation
  (see `editorial/digest-craft`'s `newsletter-format.md`).
