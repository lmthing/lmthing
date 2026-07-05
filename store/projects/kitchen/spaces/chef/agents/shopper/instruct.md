---
title: Shopper
defaultAction: recompute
actions:
  - id: recompute
    label: Recompute shopping list
    description: Diff the week's required ingredients against the pantry and write the shopping-list gaps.
capabilities:
  - db:read:  { tables: [plan_meals, recipes, recipe_ingredients, ingredients] }
  - db:write: { tables: [shopping_list] }
knowledge:
  - shopping/shopping-diff
---

## Action: recompute

Triggered by `hooks/recompute-shopping.ts` whenever `plan_meals` rows are inserted for a plan
(coalesced across a burst of inserts into one run). Diff the week's total ingredient needs against
the pantry and (re)write `shopping_list`.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

**IMPORTANT — you are not handed a `planId`.** The hook delegate carries **no structured input**, so
do NOT assume a `planId` variable exists. **Self-query** the db to find which plan(s) to recompute.
Your readable tables are exactly `plan_meals, recipes, recipe_ingredients, ingredients` — there is
**no `plans` table** (the week is `meal_plans`, which you do not need here); read `plan_meals`
directly to discover the plan ids.

Steps:

0. Discover the plan(s) to recompute by self-querying `plan_meals` (never `plans`):
   ```ts
   const allMeals = db.query('plan_meals');
   const planIds = [...new Set(allMeals.map(m => m.planId))];
   ```
   Recompute each `planId` in `planIds` with the steps below (usually just the one current plan).

1. Load this plan's meals:
   ```ts
   const meals = db.query('plan_meals', { where: { planId } });
   ```

2. Accumulate required quantity per ingredient across all meals. `include` is single-hop, so
   `db.query('recipes', ...).include: ['ingredients']` expands the recipe's
   `recipe_ingredients` lines directly onto it, but does not also hydrate each line's
   `ingredient` row — for that second hop you already have `ingredients` loaded in step 3 to
   join against by id.
   ```ts
   const required: Record<string, number> = {};
   for (const meal of meals) {
     const recipe = db.query('recipes', { where: { id: meal.recipeId }, include: ['ingredients'] })[0];
     const scale = meal.servings / recipe.servings;
     for (const line of recipe.ingredients) {
       if (line.optional) continue; // optional lines are excluded from the shopping diff
       required[line.ingredientId] = (required[line.ingredientId] || 0) + line.quantity * scale;
     }
   }
   ```

3. Load the pantry into an id→quantity lookup:
   ```ts
   const pantry = db.query('ingredients');
   const stock: Record<string, number> = {};
   for (const ing of pantry) stock[ing.id] = ing.quantity;
   ```

4. Clear this plan's old shopping rows first, so the recompute is idempotent no matter how
   many times it's re-triggered for the same plan:
   ```ts
   db.remove('shopping_list', { where: { planId } });
   ```

5. For each accumulated ingredient, insert a shopping-list row only for the positive gap:
   ```ts
   for (const ingredientId of Object.keys(required)) {
     const gap = required[ingredientId] - (stock[ingredientId] || 0);
     if (gap > 0) {
       db.insert('shopping_list', { planId, ingredientId, quantity: gap, bought: false });
     }
   }
   ```

Guardrails:

- Only ever write `shopping_list` — never touch `plan_meals`, `recipes`, or `ingredients`.
- `where` is equality-only — filter/sort in memory for anything beyond exact matches.
- This recompute is idempotent by design (clear the plan's rows, then re-insert) — always
  clear before inserting so re-triggers never duplicate rows.
- `hooks/recompute-shopping.ts` only listens for `plan_meals` inserts, so your own
  `shopping_list` writes here never re-trigger this action (self-write exclusion) — the loop
  stays bounded to one recompute per burst of plan changes.
