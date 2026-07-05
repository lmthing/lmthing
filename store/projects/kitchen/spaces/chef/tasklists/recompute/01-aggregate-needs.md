---
id: aggregate_needs
dependsOn: []
role: explore
functions: [scaleQuantity]
output:
  required: object
---

Load the plan's meals and accumulate required quantity per ingredient across all of them, scaled
to each meal's own `servings`. `include` is single-hop, so a recipe's `ingredients` line expands
directly onto it but does not also hydrate each line's `ingredient` row — that second hop isn't
needed here since the diff only needs ids and quantities:

```ts
const meals = db.query('plan_meals', { where: { planId } });

const required: Record<string, number> = {};
for (const meal of meals) {
  const recipe = db.query('recipes', { where: { id: meal.recipeId }, include: ['ingredients'] })[0];
  for (const line of recipe.ingredients) {
    if (line.optional) continue; // optional lines are excluded from the shopping diff
    const scaled = scaleQuantity(line.quantity, recipe.servings, meal.servings);
    required[line.ingredientId] = (required[line.ingredientId] || 0) + scaled;
  }
}

currentTask.resolve({ required });
```

If the plan has no meals yet, `required` resolves as `{}` — `write_gaps` will simply clear any
stale `shopping_list` rows and insert nothing.
