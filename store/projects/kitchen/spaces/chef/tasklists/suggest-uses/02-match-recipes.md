---
id: match_recipes
dependsOn: [find_expiring]
role: explore
output:
  matches: array
---

For each expiring ingredient, find a recipe whose `recipe_ingredients` lines call for it — hydrate
each recipe's lines with a single-hop `include` and match on `ingredientId`. When more than one
recipe qualifies, prefer the one that also uses other in-stock pantry items (a recipe you can
mostly make from what's already on hand, not one that needs a special trip):

```ts
const recipes = db.query('recipes');
const pantryIds = new Set(db.query('ingredients').map((i) => i.id));

const matches = find_expiring.expiring.map((ing) => {
  const candidates = recipes
    .map((r) => db.query('recipes', { where: { id: r.id }, include: ['ingredients'] })[0])
    .filter((r) => r.ingredients.some((line) => line.ingredientId === ing.id));

  const best = candidates.sort((a, b) => {
    const stockCountA = a.ingredients.filter((l) => pantryIds.has(l.ingredientId)).length;
    const stockCountB = b.ingredients.filter((l) => pantryIds.has(l.ingredientId)).length;
    return stockCountB - stockCountA;
  })[0];

  return { ingredientId: ing.id, ingredientName: ing.name, recipeId: best?.id ?? null };
});

currentTask.resolve({ matches });
```

If no recipe uses a given ingredient at all, still include it in `matches` with `recipeId: null` —
`write_cards` still surfaces the waste warning, just without a recipe suggestion attached. Never
fabricate a `recipeId` that doesn't actually contain the ingredient.
