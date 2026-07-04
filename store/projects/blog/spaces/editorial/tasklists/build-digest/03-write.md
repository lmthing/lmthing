---
id: write
dependsOn: [cluster]
role: general
output:
  digestId: string
---

Write the digest and its items from `cluster.slots`. **No digest id is passed to this task** — the
hook/spawn/chat paths do not deliver structured input — so **self-query**: fill the oldest digest the
`buildDigest` API left in `status: 'building'`, or insert a fresh one when there is none.

```ts
// Self-query: is there a pre-seeded `building` digest waiting to be filled (from a buildDigest
// click)? `where` is equality-only, so filter/sort in memory. Take the oldest.
const building = db.query('digests')
  .filter(d => d.status === 'building')
  .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

let id;
if (building.length > 0) {
  // Fill the pre-seeded row in.
  id = building[0].id;
  db.update('digests', {
    where: { id },
    set: {
      title, // your own digest headline
      summary, // one-paragraph deck for the archive
      articleCount: cluster.slots.length,
      status: 'ready',
    },
  });
} else {
  // No pre-seeded row — daily cron / chat path: insert a brand-new digest.
  const d = db.insert('digests', {
    title,
    summary,
    period: 'daily',
    articleCount: cluster.slots.length,
    status: 'ready',
  });
  id = d.id;
}

// One digest_items row per slot — only ever reference real article ids from cluster.slots,
// never invent one.
for (const slot of cluster.slots) {
  db.insert('digest_items', {
    digestId: id,
    articleId: slot.articleId,
    topicSlug: slot.topicSlug,
    position: slot.position,
    blurb: slot.blurb,
  });
}

currentTask.resolve({ digestId: id });
```

Guardrails:

- `where` is equality-only — filter/sort in memory for anything more complex.
- Never fabricate an `articleId` for a `digest_items` row — every slot must trace back to a real
  `articles` row that `cluster` actually selected.
- If `cluster.slots` ends up empty (nothing worth digesting), still write the digest with
  `articleCount: 0` and an honest summary saying so, rather than skipping the write and leaving a
  `building` row stuck forever.
