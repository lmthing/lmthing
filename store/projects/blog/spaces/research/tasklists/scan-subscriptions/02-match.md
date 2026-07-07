---
id: match
role: general
dependsOn: [load]
functions:
  - matchSubscription
  - dedupeAlerts
output:
  inserted: number
---

Test every active subscription against every recent article. Run **two** match layers, then dedupe
and insert only the survivors.

**Layer 1 — literal.** `matchSubscription` is the fast tag/keyword floor: anything it accepts is a
match, no second-guessing.

**Layer 2 — semantic intent.** For the articles `matchSubscription` did *not* accept, use your own
judgment to catch matches the literal test misses — the reader's `query` expresses an *intent*, not
just a string. A subscription for "EU AI regulation" should catch "Brussels finalizes the AI Act"
even with no shared tag; a watch on "my competitor Acme" should catch a funding round or a product
launch. Be strict: only promote an article when it genuinely serves the subscription's intent —
never stretch to fill a quiet scan. When in doubt, leave it out (a false alert is worse than a miss).

For every match (either layer), write a **genuinely useful** `summary` — one line saying *why this
matters to the watch*, not a mechanical restatement. Prefer "Matches your 'AI regulation' watch:
first concrete enforcement timeline" over "Article matched subscription".

```ts
// One statement at a time; narrate reasoning in // comments.
const candidates = [];
for (const sub of load.subs) {
  for (const article of load.articles) {
    // Layer 1: literal tag/keyword match.
    const literal = matchSubscription(article, sub.query);
    // Layer 2: if not literal, judge whether the article serves the watch's intent.
    // (Decide semantically from sub.name / sub.query intent vs article.title + article.summary;
    //  set `semantic` true only for a genuine intent match.)
    const semantic = false; // ← replace with your judgment per article
    if (!literal && !semantic) continue;
    candidates.push({
      subscriptionId: sub.id,
      articleId: article.id,
      title: `${sub.name}: ${article.title}`,
      summary: /* a specific "why this matters to this watch" line grounded in the article */ article.summary,
    });
  }
}
```

```ts
const fresh = dedupeAlerts(candidates, load.existingAlerts);
for (const alert of fresh) {
  db.insert('alerts', alert);
}
```

```ts
for (const sub of load.subs) {
  db.update('subscriptions', { where: { id: sub.id }, set: { lastRunAt: new Date().toISOString() } });
}
currentTask.resolve({ inserted: fresh.length });
```

Guardrails:

- `where` is equality-only across all `db.*` calls.
- Ground every alert in a real article — the semantic layer promotes *existing* articles it judges
  relevant, it never invents a match or a fact. Prefer a missed match over a false one.
- Every `summary` must point at something real in the article — see `research/curation-and-collections`
  and the newsroom `editorial-standards` for grounding.
- Every subscription gets its `lastRunAt` bumped even when it matched nothing this run, so the next
  scan's window logic (if any) has an accurate signal that it was actually checked.
