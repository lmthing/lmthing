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

Test every active subscription against every recent article, collect the candidate alerts, dedupe
against what's already been raised (and against duplicates within this same batch), then insert
only the survivors:

```ts
const candidates: { subscriptionId: string; articleId: string; title: string; summary?: string }[] = [];
for (const sub of load.subs) {
  for (const article of load.articles) {
    if (!matchSubscription(article, sub.query)) continue;
    candidates.push({
      subscriptionId: sub.id,
      articleId: article.id,
      title: `${sub.name}: ${article.title}`,
      summary: article.summary,
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
- Never raise an alert for an article or subscription that doesn't genuinely match — `matchSubscription`
  is the single source of truth for what counts as a match; don't hand-roll a looser check here.
- Every subscription gets its `lastRunAt` bumped even when it matched nothing this run, so the next
  scan's window logic (if any) has an accurate signal that it was actually checked.
