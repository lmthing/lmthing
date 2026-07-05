---
id: computeEach
role: general
dependsOn: [findPending]
forEach: findPending.pending
functions: [sumMacros, estimateNutrition]
output:
  planMealId: string
  day: string
  calories: number
  computed: boolean
---

Fans out over each pending `plan_meals` slot found by `findPending`. `item` is one slot row —
compute and persist its `meal_nutrition`.

Load the slot's recipe with ingredient lines hydrated. `include` is **single-hop** —
`include: ['ingredients']` expands `recipe_ingredients` onto the recipe, but does not also hydrate
each line's `ingredients` row, so that second hop is its own lookup:

```ts
const meal = item;
const recipe = db.query('recipes', { where: { id: meal.recipeId }, include: ['ingredients'] })[0];
```

If the recipe is gone (removed since the slot was planned), there is nothing to compute for this
slot — resolve a zeroed, `computed: false` result instead of throwing, so one dangling slot doesn't
sink the whole fan-out. Otherwise ensure every non-optional line has a `nutrition_facts` row
(estimating on the spot if it doesn't), sum with `sumMacros` (never hand-roll the addition), and
scale from the recipe's base `servings` to the slot's actual `servings`:

```ts
if (!recipe) {
  currentTask.resolve({ planMealId: meal.id, day: meal.day, calories: 0, computed: false });
} else {
  const facts: Record<string, { caloriesPerUnit: number; proteinPerUnit: number; carbsPerUnit: number; fatPerUnit: number }> = {};
  for (const line of recipe.ingredients ?? []) {
    if (line.optional) continue;
    let fact = db.query('nutrition_facts', { where: { ingredientId: line.ingredientId } })[0];
    if (!fact) {
      const ingredient = db.query('ingredients', { where: { id: line.ingredientId } })[0];
      const estimate = estimateNutrition(ingredient?.name ?? '', ingredient?.category, ingredient?.unit ?? 'g');
      fact = db.insert('nutrition_facts', { ingredientId: line.ingredientId, ...estimate });
    }
    facts[line.ingredientId] = fact;
  }

  const perLine = (recipe.ingredients ?? [])
    .filter(l => !l.optional)
    .map(l => {
      const f = facts[l.ingredientId];
      return {
        calories: (f?.caloriesPerUnit ?? 0) * l.quantity,
        protein: (f?.proteinPerUnit ?? 0) * l.quantity,
        carbs: (f?.carbsPerUnit ?? 0) * l.quantity,
        fat: (f?.fatPerUnit ?? 0) * l.quantity,
      };
    });
  const recipeTotals = sumMacros(perLine);
  const scale = (meal.servings || recipe.servings || 1) / (recipe.servings || 1);

  const row = db.insert('meal_nutrition', {
    planMealId: meal.id,
    calories: Math.round(recipeTotals.calories * scale),
    protein: Math.round(recipeTotals.protein * scale),
    carbs: Math.round(recipeTotals.carbs * scale),
    fat: Math.round(recipeTotals.fat * scale),
  });

  currentTask.resolve({ planMealId: meal.id, day: meal.day, calories: row.calories, computed: true });
}
```

Guardrail: `meal_nutrition.planMealId` is unique, and `findPending` already excluded slots that
already have a row — this insert is the one and only row for this slot; never `db.update` here.
