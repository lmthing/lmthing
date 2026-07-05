---
id: reportTotals
role: explore
dependsOn: [findMissing, estimateEach]
functions: [sumMacros]
output:
  reports: array
---

Report each touched recipe's per-serving totals now that its ingredients have facts. This mirrors
what `getRecipeNutrition` computes on demand for the UI — it's read-only narration for chat, never
a new persisted total (`recipes` has no total-nutrition columns of its own):

```ts
const recipeIds = findMissing.recipeIds ?? [];
const reports = [];
for (const recipeId of recipeIds) {
  const recipe = db.query('recipes', { where: { id: recipeId }, include: ['ingredients'] })[0];
  if (!recipe) continue; // recipe was removed since this pass started

  const perLine = (recipe.ingredients ?? [])
    .filter(l => !l.optional)
    .map(l => {
      const f = db.query('nutrition_facts', { where: { ingredientId: l.ingredientId } })[0];
      return {
        calories: (f?.caloriesPerUnit ?? 0) * l.quantity,
        protein: (f?.proteinPerUnit ?? 0) * l.quantity,
        carbs: (f?.carbsPerUnit ?? 0) * l.quantity,
        fat: (f?.fatPerUnit ?? 0) * l.quantity,
      };
    });
  const totals = sumMacros(perLine);
  const servings = recipe.servings > 0 ? recipe.servings : 1;

  reports.push({
    recipeId,
    title: recipe.title,
    perServing: {
      calories: Math.round(totals.calories / servings),
      protein: Math.round(totals.protein / servings),
      carbs: Math.round(totals.carbs / servings),
      fat: Math.round(totals.fat / servings),
    },
  });
}
currentTask.resolve({ reports });
```

Display each report with `NutritionSummary` in chat alongside a short note on what was estimated —
and, per `nutrition-science/macros-and-estimation`, always as an estimate (`basisNote` on the
underlying `nutrition_facts` rows), never as a precise, lab-measured figure.
