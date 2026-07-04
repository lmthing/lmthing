---
id: cluster
dependsOn: [gather]
role: general
functions:
  - clusterArticles
  - dedupeArticles
  - scoreByTopics
output:
  slots: array
---

Dedupe and cluster the candidates `gather` produced, then pick the top ~6-8 for the digest — see
`editorial/digest-craft` for how selection and ordering should read. `gather.articleIds` and
`gather.topicWeights` are in scope as the resolved output of the `gather` task.

```ts
// Load the full rows for the candidate ids (equality-only `where`, so match one at a time in
// memory rather than an IN-style query).
const all = db.query('articles');
const candidates = gather.articleIds
  .map(id => all.find(a => a.id === id))
  .filter(Boolean);

// Dedupe near-duplicate coverage of the same story before clustering.
const deduped = dedupeArticles(candidates);

// Cluster by primary topic so selection can balance breadth, not just raw score.
const clusters = clusterArticles(deduped);

// Within each cluster, rank by topic-weighted score and keep the strongest one or two.
const shortlist = clusters.flatMap(cluster =>
  cluster.articles
    .sort((a, b) => scoreByTopics(b.tags ?? [], gather.topicWeights) - scoreByTopics(a.tags ?? [], gather.topicWeights))
    .slice(0, 2)
    .map(article => ({ article, topicSlug: cluster.topicSlug })),
);

// Take the best ~6-8 across clusters, pinned articles first, for topic breadth.
const picked = shortlist
  .sort((a, b) => {
    if (!!b.article.pinned !== !!a.article.pinned) return b.article.pinned ? 1 : -1;
    return scoreByTopics(b.article.tags ?? [], gather.topicWeights) - scoreByTopics(a.article.tags ?? [], gather.topicWeights);
  })
  .slice(0, 8);

const slots = picked.map((p, i) => ({
  articleId: p.article.id,
  topicSlug: p.topicSlug,
  blurb, // your own one-line "why this matters", grounded in this article's summary/body
  position: i,
}));

currentTask.resolve({ slots });
```

Write each `blurb` yourself per `editorial/editorial-standards` — never a placeholder, and never a
restatement of the headline.
