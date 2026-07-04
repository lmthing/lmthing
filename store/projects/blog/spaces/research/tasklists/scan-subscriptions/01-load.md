---
id: load
role: general
dependsOn: []
output:
  subs: array
  articles: array
  existingAlerts: array
---

Load everything the matching step needs. `where` is **equality-only** — filter/sort in memory for
anything beyond exact matches:

```ts
const subs = db.query('subscriptions').filter(s => s.active !== false);
const articles = db.query('articles')
  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  .slice(0, 50);
const existingAlerts = db.query('alerts');
currentTask.resolve({ subs, articles, existingAlerts });
```

The recent-article window is intentionally generous (50) — it's cheaper to test a few extra
articles against each subscription than to risk missing a genuine match right at the edge of the
window.
