---
id: persist_recipe
dependsOn: [parse, find_or_create_ingredients]
role: general
output:
  recipeId: string
  ok: boolean
---

Write the recipe — or leave the stub untouched — depending on whether `parse` actually found
something. When it did, and `fetch_page.recipeId` names a stub, update it in place so the
"Importing…" placeholder resolves into the real recipe; with no stub, insert a fresh row. When it
didn't, the honest terminal state is to leave the stub exactly as it was, not overwrite a perfectly
fine placeholder with an empty recipe:

```ts
const recipeFields = {
  title: parse.title,
  description: parse.description,
  instructions: parse.instructions,
  servings: parse.servings,
  prepMinutes: 30,
  tags: [] as string[],
  source: fetch_page.targetUrl,
};

let recipeId = fetch_page.recipeId;
if (parse.ok) {
  if (recipeId) {
    db.update('recipes', { where: { id: recipeId }, set: recipeFields });
  } else {
    recipeId = db.insert('recipes', recipeFields).id;
  }
  for (const line of find_or_create_ingredients.lines) {
    db.insert('recipe_ingredients', {
      recipeId,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      optional: false,
    });
  }
}
// parse.ok === false: nothing written — the stub (if any) is left exactly as it was.

currentTask.resolve({ recipeId: parse.ok ? recipeId : (fetch_page.recipeId ?? ''), ok: parse.ok });
```

Guardrails:

- Never insert a second recipe row on top of an existing stub — always update in place when
  `fetch_page.recipeId` names one.
- Never fabricate an ingredient, quantity, or instruction step that wasn't actually on the fetched
  page — every write here traces back to `parse`'s and `find_or_create_ingredients`'s output.
- Only ever write `recipes`, `recipe_ingredients`, and (via `find_or_create_ingredients`)
  `ingredients` — nothing in this tasklist touches `meal_plans`, `plan_meals`, or `shopping_list`.
