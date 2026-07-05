---
id: find_at_risk
dependsOn: []
role: general
output:
  atRisk: array
---

Self-query the ingredients actually at risk right now — this task never trusts a passed id, since
the cron delegate that triggers this tasklist carries none:

```ts
const ingredients = db.query('ingredients');
const avgCost = ingredients.reduce((sum, i) => sum + (i.costPerUnit ?? 0), 0) / Math.max(ingredients.length, 1);
const soonMs = Date.now() + 3 * 24 * 60 * 60 * 1000; // "expiring soon" = within 3 days
```

An ingredient is at risk for one of three reasons, checked in priority order — out-of-stock beats
expiring, which beats merely being expensive — per `shopping-optimization/substitutions`'s
`when-to-suggest.md`:

```ts
function riskReason(i: (typeof ingredients)[number]): 'out-of-stock' | 'expiring' | 'cost' | null {
  if (i.quantity <= 0 || i.quantity <= (i.lowStockThreshold ?? 0)) return 'out-of-stock';
  if (i.expiresAt && new Date(i.expiresAt).getTime() <= soonMs) return 'expiring';
  if (avgCost > 0 && (i.costPerUnit ?? 0) > avgCost * 1.5) return 'cost';
  return null;
}
```

Skip anything that already has an undismissed substitution suggestion, so a re-run never
double-suggests the same ingredient:

```ts
const alreadyFlagged = new Set(
  db.query('suggestions').filter((s) => s.type === 'substitution' && !s.dismissed).map((s) => s.ingredientId),
);

const atRisk = ingredients
  .map((i) => ({ ingredient: i, reason: riskReason(i) }))
  .filter((r) => r.reason && !alreadyFlagged.has(r.ingredient.id))
  .map((r) => ({
    ingredientId: r.ingredient.id,
    name: r.ingredient.name,
    category: r.ingredient.category,
    reason: r.reason as string,
  }));

currentTask.resolve({ atRisk });
```

Guardrail: `where` is equality-only across all `db.*` calls — every filter above runs in memory,
never as a query clause.
