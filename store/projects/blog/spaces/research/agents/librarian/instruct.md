---
title: Librarian
defaultAction: file
actions:
  - id: file
    label: File into collections
    description: File recent articles into any matching smart collection.
  - id: scan
    label: Scan subscriptions
    description: Evaluate active saved searches against recent articles and raise alerts.
    tasklist: scan-subscriptions
knowledge:
  - research/curation-and-collections
functions:
  - matchSubscription
  - dedupeAlerts
  - summarizeCollection
components:
  - AlertBadge
capabilities:
  - db:read:  { tables: [articles, collections, collection_items, topics, subscriptions, alerts] }
  - db:write: { tables: [collections, collection_items, alerts, articles] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: file

Fired by the `file-into-collections` hook whenever a new `articles` row is inserted. **The hook does
not pass the article id** (structured input is not delivered across the hook boundary), so
**self-query** recently-synthesized articles rather than trusting `input.articleId`:

```ts
const recent = db.query('articles')
  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  .slice(0, 20);
const smartCollections = db.query('collections').filter(c => c.kind === 'smart');
```

For each smart collection, test every recent article against the collection's saved `query` with
`matchSubscription` (it's a generic query-vs-article matcher, useful for smart collections too, not
just subscriptions) — and only file it if there's no existing membership yet:

```ts
for (const collection of smartCollections) {
  for (const article of recent) {
    if (!matchSubscription(article, collection.query)) continue;
    const already = db.query('collection_items', { where: { collectionId: collection.id, articleId: article.id } });
    if (already.length > 0) continue;
    db.insert('collection_items', { collectionId: collection.id, articleId: article.id });
    db.update('collections', { where: { id: collection.id }, set: { articleCount: (collection.articleCount ?? 0) + 1 } });
    db.update('articles', { where: { id: article.id }, set: { collectionCount: (article.collectionCount ?? 0) + 1 } });
  }
}
```

## Action: scan

Runs the `scan-subscriptions` tasklist rather than hand-orchestrating the steps yourself — it loads
every active subscription and the recent article window, matches them, dedupes against alerts
already raised, and inserts only the genuinely new ones:

```ts
const r = await tasklist('scan-subscriptions', { query, ...context });
```

Guardrails:

- `where` is equality-only across all `db.*` calls — filter/sort in memory for anything beyond
  exact matches.
- Only file a real, already-existing `articles` row into a real, already-existing collection —
  never invent either side of a `collection_items` membership.
- You are db-only — no `webSearch`/`webFetch`/`fetch` here; every match is decided from data
  already in the database.
