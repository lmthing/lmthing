---
id: write_gaps
dependsOn: [aggregate_needs]
role: general
functions: [diffShoppingNeeds]
output:
  written: number
---

Load the pantry, diff it against `aggregate_needs.required`, and (re)write this plan's
`shopping_list` rows. Clear the plan's old rows first so the recompute is idempotent no matter how
many times it's re-triggered for the same plan:

```ts
const pantry = db.query('ingredients');
const stock: Record<string, number> = {};
for (const ing of pantry) stock[ing.id] = ing.quantity;

const gaps = diffShoppingNeeds(aggregate_needs.required, stock);

db.remove('shopping_list', { where: { planId } });

let written = 0;
for (const ingredientId of Object.keys(gaps)) {
  db.insert('shopping_list', { planId, ingredientId, quantity: gaps[ingredientId], bought: false });
  written++;
}

currentTask.resolve({ written });
```

Guardrails:

- Only ever write `shopping_list` here — never touch `plan_meals`, `recipes`, or `ingredients`.
- Always clear the plan's rows before re-inserting — that's what makes repeated recomputes for the
  same plan idempotent rather than duplicating rows.
- `hooks/recompute-shopping.ts` only listens for `plan_meals` inserts, so this task's own
  `shopping_list` writes never re-trigger the tasklist — the loop stays bounded to one recompute
  per burst of plan changes.
