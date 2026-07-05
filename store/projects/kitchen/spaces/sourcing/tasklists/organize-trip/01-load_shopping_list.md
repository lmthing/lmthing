---
id: load_shopping_list
dependsOn: []
role: general
output:
  planId: string
  lines: array
---

Resolve the plan — the one named by `planId`, or the most recent by `weekStart` when none was
given (`where` is equality-only, so sort in memory):

```ts
const plan = planId
  ? db.query('meal_plans', { where: { id: planId } })[0]
  : db.query('meal_plans').sort((a, b) => (b.weekStart ?? '').localeCompare(a.weekStart ?? ''))[0];
```

Load its shopping list, hydrating each row's ingredient in the same call (`include` is single-hop,
so `ingredient` comes along directly), and drop anything already bought — only what's still needed
belongs in a trip:

```ts
const rows = plan
  ? db.query('shopping_list', { where: { planId: plan.id }, include: ['ingredient'] })
  : [];

const lines = rows
  .filter((r) => !r.bought)
  .map((r) => ({
    ingredient: r.ingredient?.name ?? '',
    unit: r.ingredient?.unit ?? '',
    quantity: r.quantity,
    category: r.ingredient?.category ?? 'other',
    estCost: r.quantity * (r.ingredient?.costPerUnit ?? 0),
  }));

currentTask.resolve({ planId: plan?.id ?? '', lines });
```

Guardrail: an empty `lines` array (no plan found, or everything already bought) is a legitimate
result — `group_and_write` writes a trip with an empty `organized` array rather than treating it as
an error.
