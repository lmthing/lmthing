# PLAN — `kitchen` project-application (round 1, CORE BUILD)

File-by-file plan. Output root: **`store/projects/kitchen/`** (monorepo). `types/` + `.data/` +
`node_modules/` git-ignored. All contracts grounded in the shipped engine (see PROGRESS
"Environment") and the `store/projects/blog/` reference.

## Root files
- `package.json` — name `@lmthing/app-kitchen`, private, type module, deps `react`, `react-dom`,
  `@lmthing/ui` (workspace:*), `@lmthing/css` (workspace:*). (Resolved from cli node_modules by the
  pages build; no install needed for the runtime build.)
- `tsconfig.json` — same sensible default as blog (react-jsx, strict, Bundler moduleRes,
  include pages/components/lib/api/hooks/types).
- `.gitignore` — `types/`, `.data/`, `node_modules/`, `dist/`.
- `README.md` — one-paragraph what/how + install pointer.

## database/ (6 tables — descriptions mandatory, FK/relations resolve; per spec §Database + round-1 col)
- `ingredients.json` — id(pk uuid), name(req,unique), category, unit(req), quantity(def 0),
  lowStockThreshold(def 0), updatedAt(now); relations usedIn→recipe_ingredients(via ingredientId),
  shopping→shopping_list(via ingredientId).
- `recipes.json` — id, title(req), description, instructions(req), servings(def 2), prepMinutes(def 30),
  tags(json), **imageUrl (new)**, source; relations ingredients→recipe_ingredients(via recipeId),
  meals→plan_meals(via recipeId).
- `recipe_ingredients.json` — id, recipeId→recipes(cascade,req), ingredientId→ingredients(restrict,req),
  quantity(req), optional(def false); relations recipe(belongsTo recipes), ingredient(belongsTo ingredients).
- `meal_plans.json` — id, weekStart(date,req,unique), status(def 'planning'), createdAt(now);
  relations meals→plan_meals(via planId), shopping→shopping_list(via planId).
- `plan_meals.json` — id, planId→meal_plans(cascade,req), recipeId→recipes(restrict,req), day(date,req),
  meal(req), servings(def 2); relations plan(belongsTo meal_plans), recipe(belongsTo recipes).
- `shopping_list.json` — id, planId→meal_plans(cascade,req), ingredientId→ingredients(cascade,req),
  quantity(req), bought(def false); relations plan(belongsTo meal_plans), ingredient(belongsTo ingredients).
- Verify: many-to-many resolves (recipes↔recipe_ingredients↔ingredients) + meal_plans→plan_meals→recipes;
  row types Ingredient/Recipe/RecipeIngredient/MealPlan/PlanMeal/**ShoppingList**.

## api/ (14 endpoints) — each name/description/Input/Output + default async handler; `@app/runtime` HttpError; AsyncDbApi (await)
- `plan/GET.ts` → `currentPlan` `{}` → `MealPlan & { meals: (PlanMeal & { recipe })[] }` (most recent
  meal_plan by weekStart; include meals; hydrate each meal's recipe via a second query since nested
  include depth is per-relation). Returns null-ish (`{ id:null }`? no) → return the plan object or a
  `{ plan: null }` sentinel. **Decision:** Output = `MealPlan | null`-shaped; handler returns the plan
  or `null` (page guards). Keep Output an interface with the shape; return `null` typed via `Output`.
  (Simpler: Output = `{ plan: FullPlan | null }`. Use that to keep a stable object.)
- `plan/POST.ts` → `generatePlan` `{ weekStart? }` → `{ planId, status }` — create a meal_plans row
  (status 'planning'), then `ctx.spawn('chef/planner#plan', { planId }, { onError })` fire-and-forget;
  return immediately. weekStart defaults to the Monday of the current week (computed in handler).
- `plan/[id]/shopping/GET.ts` → `shoppingList` `{ id }` → `{ items: (ShoppingList & { ingredient })[] }`
  — the join diff READ path: read shopping_list rows for the plan with include ingredient; if none
  persisted yet, compute on the fly (plan → plan_meals → recipe → recipe_ingredients → ingredient, sum
  scaled required − pantry) and return the positive gaps (read-only; the shopper persists rows).
- `recipes/GET.ts` → `listRecipes` `{ tag? }` → `Recipe[]` (query-all; JS filter by tag; orderBy title).
- `recipes/POST.ts` → `addRecipe` `{ title, instructions, description?, servings?, prepMinutes?, tags?,
  ingredients?: [{name,quantity,unit,optional?}] }` → `Recipe` — insert recipe; for each ingredient
  line, find-or-create the ingredient by name (equality where on name), then insert recipe_ingredients.
- `recipes/[id]/GET.ts` → `getRecipe` `{ id }` → `Recipe & { ingredients: (RecipeIngredient &
  { ingredient })[] }` — include ['ingredients'] then hydrate each line's ingredient (second query per
  line or one query-all ingredients + map). 404 HttpError if missing.
- `meals/[id]/PATCH.ts` → `updateMeal` `{ id, recipeId?, day?, servings?, meal? }` → `PlanMeal`
  (update set of provided fields; return the row).
- `meals/[id]/DELETE.ts` → `removeMeal` `{ id }` → `{ ok }`.
- `pantry/GET.ts` → `listPantry` `{}` → `Ingredient[]` (orderBy category then name).
- `pantry/low/GET.ts` → `lowStock` `{}` → `Ingredient[]` (query-all; JS filter quantity ≤ lowStockThreshold).
- `pantry/POST.ts` → `addIngredient` `{ name, unit, quantity?, category?, lowStockThreshold? }` →
  `Ingredient` — find-or-create by name (unique); if exists, return it.
- `pantry/[id]/PATCH.ts` → `updatePantry` `{ id, quantity }` → `Ingredient` (set quantity + updatedAt now).
- `shopping/[id]/PATCH.ts` → `toggleBought` `{ id, bought }` → `{ ok }` — set bought; when bought=true,
  top up pantry: read the shopping row (ingredientId, quantity), read the ingredient, updatePantry
  quantity += bought quantity.
- `stats/GET.ts` → `kitchenStats` `{}` → `{ recipes, pantryItems, lowStock, plannedMeals, shoppingGaps }`
  (counts via query-all + length; lowStock = filter; plannedMeals = current plan's plan_meals count;
  shoppingGaps = current plan's unbought shopping_list count).

## hooks/ (2)
- `plan-week.ts` — cron `{ type:'cron', daily:'18:00', trigger:'chef/planner#plan',
  budget:{maxEpisodes:15,maxWallClockMs:600000} }`. (Planner no-ops unless Sunday — enforced in prompt.)
- `recompute-shopping.ts` — database `{ type:'database', on:{table:'plan_meals',event:'insert'},
  budget:{maxEpisodes:6}, handler: async ({row,delegate}) => delegate('chef/shopper','recompute',
  {input:{planId:row.planId}}) }`. Coalesce collapses a week of inserts → one recompute; self-write
  exclusion on shopping_list keeps it bounded.

## spaces/chef/ (project-scoped space; 3 agents — least privilege, db-only round 1)
- `agents/planner/instruct.md` — title Planner; defaultAction `plan`; actions: [plan]; capabilities
  db:read[recipes,recipe_ingredients,ingredients,meal_plans,plan_meals] db:write[meal_plans,plan_meals].
  `plan` tasklist uses a day-`forEach` (7 days) — but round 1 keep it model-driven in instruct
  (forEach tasklist optional; the blog agents were model-driven via `actions:` empty tasklist). Prompt:
  Sunday-gate, read pantry+recipes, slot dinners for the 7 days honoring pantry/tags, write plan_meals.
  Equality-only-where rule embedded.
- `agents/shopper/instruct.md` — title Shopper; defaultAction `recompute`; actions:[recompute];
  capabilities db:read[plan_meals,recipes,recipe_ingredients,ingredients] db:write[shopping_list].
  Prompt: the join diff — read the plan's plan_meals, each recipe's recipe_ingredients×servings scale,
  sum required per ingredient, subtract pantry quantity, delete old shopping_list rows for the plan,
  insert positive gaps. Idempotent.
- `agents/pantry-keeper/instruct.md` — title Pantry Keeper; defaultAction `chat`; actions:[chat];
  capabilities db:read[ingredients] db:write[ingredients]. Chat control surface: user narrates pantry
  changes → find-or-create + update ingredients.
- Each agent also gets a `charter.md` (short fork-safe identity, no ask/UI prose).

## pages/ + components/ (design tokens ONLY — no raw colors)
- `pages/_app.tsx` — pass-through wrapper (like blog).
- `pages/_layout.tsx` — nav chrome: This Week (/) · Recipes (/recipes) · Pantry (/pantry) ·
  Shopping (/shopping). Tokens only.
- `pages/index.tsx` — current week grid: `kitchenStats` strip + `currentPlan`; WeekGrid of day×meal.
  Poll while status==='planning'. Empty state → "Plan this week" button → `generatePlan`.
- `pages/recipes/index.tsx` — `listRecipes`; RecipeCard grid; tag filter.
- `pages/recipes/[id].tsx` — `getRecipe` (join render ingredient lines); MarkdownBody instructions.
- `pages/pantry.tsx` — `listPantry` + `lowStock`; IngredientRow edit quantity (updatePantry);
  add ingredient form (addIngredient); `<Chat agent="chef/pantry-keeper" />` widget.
- `pages/plan/[planId].tsx` — a specific week grid (currentPlan-shaped by id); updateMeal swap.
  (Round 1: reuse WeekGrid; read via currentPlan for the latest, or a plan-by-id read — use currentPlan
  shape; for a specific planId, read shoppingList/meals through existing endpoints. Keep simple: render
  the plan's meals + its shopping link.)
- `pages/shopping.tsx` — current plan's `shoppingList`; ShoppingRow with toggleBought checkbox.
- `components/` — `WeekGrid.tsx`, `MealCell.tsx`, `RecipeCard.tsx`, `IngredientRow.tsx`,
  `ShoppingRow.tsx`, `StatsStrip.tsx`, `Spinner.tsx`, `MarkdownBody.tsx`.

## types/ (generated — do not author)
Produced by the contracts/pages build → `types/generated.d.ts`. Git-ignored.

## Tests — `store/projects/kitchen/tests/kitchen.test.mjs` (`node --test`, dependency-free)
Mirror `store/projects/blog/tests/blog.test.mjs`:
- Schemas: `validateSchemaSet` (real built `@lmthing/core`) passes for all 6 tables; every table/col/
  relation has a description; exactly-one PK each; row-type names resolve (assert ShoppingList).
- API: all 14 handlers exist + export name/Input/Output/default async handler; name matches expected.
- Specific: `toggleBought` tops up pantry (source references updatePantry/pantry write); `shoppingList`
  computes the diff (references include + subtract); `generatePlan` spawns the planner.
- Hooks: plan-week is cron→chef/planner#plan; recompute-shopping is database:insert on plan_meals with
  delegate to chef/shopper.
- Agents: chef has 3 agents, each with least-privilege capabilities and NO authoring caps
  (db:schema/pages:write/api:write/hooks:write forbidden); per-verb table scope present.

## Live e2e (Phase 4) — DeepSeek `--model S` via sdk/org/.env
Materialize kitchen into a temp `LMTHING_ROOT`'s `<root>/kitchen/`, `node sdk/org/libs/cli/dist/cli/
bin.js serve --port <p>`. Then:
1. Seed via api: addIngredient ×N, addRecipe ×N (with ingredient lines).
2. `generatePlan` → planner (live DeepSeek) forEach-slots plan_meals for the week → the burst of
   inserts coalesces into ONE `recompute-shopping` → shopper writes shopping_list gaps.
3. `shoppingList` shows only the gaps; `toggleBought` tops up pantry; recompute reflects it.
4. Chat: `<Chat agent="chef/pantry-keeper">` "used the last of the milk" → ingredient quantity drops.
Fallback to a mock streamFn ONLY if AZURE key missing (record in PROGRESS).

## Sequence (verifiable steps)
1. root + database/ → `loadProjectApp`/`validateSchemaSet` green (schema test).
2. spaces/chef agents → space loads + typechecks (capability gate).
3. api/ handlers → contract generation + structural tests + HTTP smoke under serve.
4. hooks/ → loader + dispatch.
5. pages/components → `buildProjectPages` succeeds; lint:tokens green.
6. Materialize + serve + live planner→shopper loop (DeepSeek).
7. Green gate → commit + push both repos (submodule first).

## Fan-out (parallel Sonnet subagents by directory, per saved feedback)
- A: `database/` + root files (package.json/tsconfig/.gitignore/README).
- B: `api/` (14 handlers).
- C: `pages/` + `components/`.
- D: `hooks/` + `spaces/chef/`.
Then orchestrator integrates, writes tests, runs the engine loaders/build, live e2e, push.
