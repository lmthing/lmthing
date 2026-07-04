# lmthing.kitchen — pantry + meal planner (project-application)

A concrete [project-as-application](../../../sdk/org/project-as-application.md): the `kitchen`
project owns an app that knows what's in your pantry, plans a week of meals from your recipes, and
generates a shopping list for exactly what you're missing.

- **`database/`** — six tables: `ingredients` (pantry stock), `recipes`, `recipe_ingredients` (the
  recipe⇄ingredient join), `meal_plans`, `plan_meals`, `shopping_list`. The relations-heavy example
  (a many-to-many through `recipe_ingredients`, plus `meal_plans → plan_meals → recipes`).
- **`pages/`** — client-side React: the week grid (`/`), recipes (`/recipes`, `/recipes/:id`), the
  pantry (`/pantry`), a specific week (`/plan/:planId`), and the shopping list (`/shopping`).
- **`api/`** — 14 named, typed Node endpoints (`currentPlan`, `generatePlan`, `shoppingList`,
  `listRecipes`, `addRecipe`, `getRecipe`, `updateMeal`, `removeMeal`, `listPantry`, `lowStock`,
  `addIngredient`, `updatePantry`, `toggleBought`, `kitchenStats`).
- **`hooks/`** — `plan-week` (cron, Sunday-gated → `chef/planner#plan`) and `recompute-shopping`
  (`database` insert on `plan_meals` → `chef/shopper#recompute`). The plan→shopping loop is bounded
  (coalesce + self-write exclusion).
- **`spaces/chef/`** — the project-scoped space: `planner` (writes the week), `shopper` (the join diff
  → shopping gaps), `pantry-keeper` (chat: keeps pantry stock accurate). Least-privilege, per-verb
  table scope, db-only in round 1.

## Local dev

Materialize this template into a pod root's `<root>/kitchen/`, then
`node sdk/org/libs/cli/dist/cli/bin.js serve --port 8080` and open
`localhost:8080/app/kitchen/`. `types/` and `.data/` are generated/runtime (git-ignored).

## Tests

```bash
node --test store/projects/kitchen/tests/
```

(Schemas validated with the real engine `validateSchemaSet`; handlers/hooks/agents asserted
structurally. Requires the built `@lmthing/core` in `sdk/org`.)
