---
id: findMissing
role: explore
dependsOn: []
output:
  missingIds: array
  recipeIds: array
---

Find every distinct ingredient used in a recipe line that has no `nutrition_facts` row yet, and
note which recipes reference at least one of them (so the report step below knows what to report
on). `where` is equality-only, so the anti-join happens in memory:

```ts
const lines = db.query('recipe_ingredients');
const known = new Set(db.query('nutrition_facts').map(f => f.ingredientId));
const missingIds = Array.from(new Set(lines.map(l => l.ingredientId).filter(id => !known.has(id))));
```

```ts
const recipeIds = Array.from(new Set(lines.filter(l => missingIds.includes(l.ingredientId)).map(l => l.recipeId)));
currentTask.resolve({ missingIds, recipeIds });
```
