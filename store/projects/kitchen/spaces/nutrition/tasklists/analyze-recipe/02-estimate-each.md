---
id: estimateEach
role: general
dependsOn: [findMissing]
forEach: findMissing.missingIds
functions: [estimateNutrition]
optional: true
output:
  ingredientId: string
  estimated: boolean
---

Fans out over each missing ingredient id found by `findMissing`. `item` is one `ingredientId` —
estimate and insert its `nutrition_facts` row. Re-check right before inserting:
`nutrition_facts.ingredientId` is unique, and another concurrent run (or a re-trigger of this same
hook) may have just filled this same gap.

```ts
const ingredientId = item;
const existing = db.query('nutrition_facts', { where: { ingredientId } })[0];
```

```ts
if (existing) {
  currentTask.resolve({ ingredientId, estimated: false }); // idempotent guard — already filled by an earlier pass
} else {
  const ingredient = db.query('ingredients', { where: { id: ingredientId } })[0];
  if (!ingredient) {
    currentTask.resolve({ ingredientId, estimated: false }); // dangling reference — nothing to estimate for
  } else {
    const estimate = estimateNutrition(ingredient.name, ingredient.category, ingredient.unit);
    db.insert('nutrition_facts', { ingredientId, ...estimate });
    currentTask.resolve({ ingredientId, estimated: true });
  }
}
```

This task is `optional` — one ingredient that can't be resolved (a dangling reference) must not
sink the whole recipe-analysis pass.
