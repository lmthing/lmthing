> ⚠️ **OUTSTANDING — operator directive (2026-07-04):** this app's round-1 project space was
> created with **only `agents/`**, which violates the space format. On the **next (expansion)
> round** you MUST remediate it to the **FULL space format**: add a `charter.md` per agent
> (alongside `instruct.md`), plus `tasklists/`, `functions/`, `components/`, and especially
> **extensive `knowledge/`** (each field = `index.md` overview + ≥2 `<aspect>.md` deep-dives).
> See `automation/app-builder/prompt.tmpl.md` → Phase 3 "Project-scoped spaces MUST follow the
> FULL space format" and the round policy's "SPACE-FORMAT REMEDIATION" item. This is required
> work, not optional.

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

---

# PLAN — round 2 (FEATURE EXPANSION): Nutrition, Sourcing & Kitchen Intelligence

Strictly additive. Root unchanged `store/projects/kitchen/`. All contracts grounded in the shipped
engine + the round-1 build + the `store/projects/blog` full-format reference. Row-type names verified
against the engine singularizer.

## database/ (+6 tables, +5 columns) — descriptions mandatory; FK/relations resolve
- `settings.json` — Setting. cols: id(pk uuid), householdSize(number def 2), diet(string def 'none'),
  allergies(json), dislikes(json), cuisines(json), maxPrepMinutes(number def 45), calorieTarget(number
  def 2000), proteinTarget(number def 80), updatedAt(now). (single-row; getSettings seeds it.)
- `nutrition_facts.json` — NutritionFact. cols: id(pk uuid), ingredientId(FK ingredients cascade, req,
  unique), caloriesPerUnit(number def 0), proteinPerUnit(number def 0), carbsPerUnit(number def 0),
  fatPerUnit(number def 0), basisNote(string). relation ingredient(belongsTo ingredients).
- `meal_nutrition.json` — MealNutrition. cols: id(pk uuid), planMealId(FK plan_meals cascade, req,
  unique), calories(number def 0), protein(number def 0), carbs(number def 0), fat(number def 0),
  computedAt(now). relation meal(belongsTo plan_meals via planMealId).
- `substitutions.json` — Substitution. cols: id(pk uuid), ingredientId(FK ingredients cascade, req),
  substituteName(string req), ratio(number def 1), reason(string req), note(string), createdAt(now).
  relation ingredient(belongsTo ingredients).
- `shopping_trips.json` — ShoppingTrip. cols: id(pk uuid), planId(FK meal_plans cascade, req),
  store(string), estimatedCost(number def 0), organized(json), status(string def 'draft'), createdAt(now).
  relation plan(belongsTo meal_plans).
- `suggestions.json` — Suggestion. cols: id(pk uuid), type(string req), title(string req), body(string),
  ingredientId(FK ingredients setNull), recipeId(FK recipes setNull), priority(number def 0),
  dismissed(boolean def false), createdAt(now). relations ingredient(belongsTo ingredients),
  recipe(belongsTo recipes).
- COLUMN ADDS: ingredients += expiresAt(date), costPerUnit(number def 0), nutrition(hasMany
  nutrition_facts via ingredientId), substitutes(hasMany substitutions via ingredientId). recipes +=
  cuisine(string). plan_meals += rating(number), cookedAt(date), nutrition(hasMany meal_nutrition via
  planMealId). meal_plans += trips(hasMany shopping_trips via planId).
- Verify: all 12 tables validate via validateSchemaSet; row types Setting/NutritionFact/MealNutrition/
  Substitution/ShoppingTrip/Suggestion generate.

## api/ (+13 endpoints → 27) — name/description/Input/Output + default async handler; inline Db/Ctx types
- `settings/GET.ts` getSettings — read the single settings row; if none, insert defaults; return it.
- `settings/PATCH.ts` updateSettings — get-or-seed the row, update provided fields, updatedAt now.
- `recipes/import/POST.ts` importRecipe {url} → insert stub recipe (title 'Importing…', source url,
  instructions ''), spawn('sourcing/importer#import',{recipeId,url}) fire-and-forget; return {recipeId,status}.
- `meals/[id]/rating/PATCH.ts` rateMeal {id,rating} → update plan_meals set rating; return row.
- `meals/[id]/cooked/POST.ts` markCooked {id} → update plan_meals set cookedAt now; return row.
- `recipes/[id]/nutrition/GET.ts` getRecipeNutrition {id} → include recipe_ingredients, hydrate each
  ingredient's nutrition_facts, sum cal/protein/carbs/fat × line.quantity; list missing names.
- `plan/[id]/nutrition/GET.ts` getPlanNutrition {id} → plan.meals → per meal recipe nutrition scaled by
  servings, grouped per day; targets from settings; adherence ratio.
- `pantry/expiring/GET.ts` listExpiring {withinDays?=3} → query-all ingredients, filter non-null
  expiresAt within N days, sort by expiresAt.
- `plan/[id]/trip/GET.ts` getShoppingTrip {id} → compute the diff (like shoppingList) then group by
  ingredient.category into aisles, estCost = gap × costPerUnit, sum estimatedCost.
- `substitutions/[ingredientId]/GET.ts` listSubstitutions {ingredientId} → query substitutions where
  ingredientId, hydrate ingredient.
- `nutrition/stats/GET.ts` nutritionStats {} → current plan per-day nutrition, week totals/avg, target,
  onTrack boolean.
- `suggestions/GET.ts` listSuggestions {type?} → query-all suggestions, filter !dismissed (+ type),
  hydrate ingredient/recipe, sort priority desc.
- `suggestions/[id]/PATCH.ts` dismissSuggestion {id} → set dismissed true; return {ok}.

## hooks/ (+4 → 6)
- `compute-nutrition.ts` — database plan_meals:insert → trigger 'nutrition/nutritionist#compute';
  budget {maxEpisodes:8}. (guard row undefined; declarative trigger — agent self-queries missing meals.)
- `enrich-recipe-nutrition.ts` — database recipes:insert → 'nutrition/nutritionist#analyze-recipe';
  budget {maxEpisodes:8}.
- `use-it-up.ts` — cron daily:'08:00' → 'chef/planner#suggest-uses'; budget {maxEpisodes:8}.
- `nightly-substitutions.ts` — cron daily:'07:00' → 'sourcing/optimizer#substitutions'; budget {maxEpisodes:8}.

## spaces/ — chef REMEDIATION (full format) + nutrition + sourcing (born full)
Full format each = agents/<slug>/{charter.md,instruct.md} + tasklists/ + functions/ + components/ +
knowledge/<field>/{index.md + ≥2 aspect.md}.

### spaces/chef (remediate)
- planner instruct: add db:read settings, db:write suggestions, actions [plan, suggest-uses]; knowledge
  [meal-planning, pantry-management]; functions [scoreRecipeForWeek, scaleQuantity, isExpiringSoon];
  components [PlanPreview]. tasklists/plan (index + 01-read + 02-slot forEach days), tasklists/suggest-uses.
- shopper instruct: knowledge [shopping]; functions [sumRequired, diffPantry, formatShoppingLine];
  components [ShoppingListPreview]. tasklists/recompute (index + task).
- pantry-keeper instruct: knowledge [pantry-management]; functions [normalizeUnit]; components [PantryUpdatePreview].
- functions/: scoreRecipeForWeek.ts, scaleQuantity.ts, isExpiringSoon.ts, sumRequired.ts, diffPantry.ts,
  formatShoppingLine.ts, normalizeUnit.ts.
- components/view/: PlanPreview.tsx, ShoppingListPreview.tsx, PantryUpdatePreview.tsx.
- knowledge/: meal-planning/{index, pantry-first-planning, variety-and-rotation, dietary-constraints},
  pantry-management/{index, units-and-quantities, waste-reduction}, shopping/{index, the-diff-method, aisle-organization}.

### spaces/nutrition (new)
- agents/nutritionist {charter,instruct}: db:read [recipes,recipe_ingredients,ingredients,plan_meals,
  meal_plans,nutrition_facts,settings]; db:write [meal_nutrition,nutrition_facts,suggestions]; actions
  [compute, analyze-recipe]; knowledge [nutrition-science]; functions [estimateNutrition,sumMacros,
  macroTargetStatus]; components [NutritionSummary]. tasklists/compute, tasklists/analyze-recipe.
- agents/coach {charter,instruct}: db:read [settings,meal_plans,plan_meals,recipes,meal_nutrition,
  nutrition_facts,suggestions]; db:write [settings,suggestions]; defaultAction chat; knowledge
  [nutrition-science, coaching]; functions [macroTargetStatus]; components [NutritionSummary].
- functions/: estimateNutrition.ts, sumMacros.ts, macroTargetStatus.ts.
- components/view/: NutritionSummary.tsx, MacroBadge.tsx.
- knowledge/: nutrition-science/{index, macros-and-energy, estimating-from-ingredients, dietary-patterns},
  coaching/{index, goal-setting, not-a-dietitian}.

### spaces/sourcing (new)
- agents/importer {charter,instruct}: db:read [ingredients,recipes]; db:write [recipes,recipe_ingredients,
  ingredients]; functions [webFetch,webSearch,fetch,parseRecipe,matchIngredient]; actions [import];
  knowledge [recipe-import]; components [ImportedRecipePreview]. tasklists/import (index + 01-fetch + 02-insert).
- agents/optimizer {charter,instruct}: db:read [shopping_list,ingredients,meal_plans,plan_meals,recipes,
  recipe_ingredients,substitutions,settings,suggestions]; db:write [shopping_trips,substitutions,
  suggestions]; actions [organize, substitutions]; knowledge [shopping-optimization]; functions
  [groupByAisle,estimateTripCost,suggestSubstitute]; components [ShoppingTripPreview]. tasklists/organize,
  tasklists/substitutions.
- functions/: parseRecipe.ts, matchIngredient.ts, groupByAisle.ts, estimateTripCost.ts, suggestSubstitute.ts.
  NOTE: webFetch/webSearch/fetch are SYSTEM globals — list them in the importer instruct `functions:` and
  in the import tasklist task `functions:` allowlist (they are NOT space functions and have no .ts file).
- components/view/: ImportedRecipePreview.tsx, ShoppingTripPreview.tsx.
- knowledge/: recipe-import/{index, parsing-recipe-pages, matching-ingredients},
  shopping-optimization/{index, aisle-order, substitutions-and-cost}.

## pages/ + components/ (+5 pages, design tokens ONLY)
- pages/preferences.tsx — getSettings/updateSettings form (PreferencesForm) + <Chat nutrition/coach>.
- pages/nutrition.tsx — getPlanNutrition + nutritionStats; per-day MacroBar vs targets.
- pages/import.tsx — importRecipe URL form (ImportForm) + <Chat sourcing/importer>.
- pages/trip/[planId].tsx — getShoppingTrip aisle groups (AisleGroup) + cost + <Chat sourcing/optimizer>.
- pages/expiring.tsx — listExpiring (ExpiringRow) + listSuggestions/dismissSuggestion (SuggestionCard).
- Additive edits: _layout nav (+Nutrition +Preferences +Import +Expiring), index suggestions strip,
  recipes/[id] nutrition panel.
- components/: PreferencesForm.tsx, MacroBar.tsx, ImportForm.tsx, AisleGroup.tsx, ExpiringRow.tsx,
  SuggestionCard.tsx, RatingStars.tsx.

## Tests — extend store/projects/kitchen/tests/kitchen.test.mjs
- Schemas: all 12 tables validate; new row types resolve (Setting/NutritionFact/MealNutrition/
  Substitution/ShoppingTrip/Suggestion); new columns present.
- API: 27 handlers exist + export name/Input/Output/default; new names present.
- Hooks: 6 total; compute-nutrition/enrich-recipe-nutrition are database hooks; use-it-up/
  nightly-substitutions are cron; existing 2 unchanged.
- Spaces: 3 spaces (chef/nutrition/sourcing); each full format (tasklists+functions+components+≥1
  knowledge field w/ index+≥2 aspects per field); new agents least-privilege, per-verb table scope,
  NO authoring caps; importer has functions webFetch/webSearch/fetch.

## Live e2e (Phase 4) — DeepSeek --model S via sdk/org/.env, under `lmthing serve` on a temp root
1. Seed via api (addIngredient with expiresAt/costPerUnit, addRecipe).
2. updateSettings (diet/targets). getSettings seeds+returns.
3. generatePlan via chat planner → plan_meals inserts → compute-nutrition fires → nutritionist writes
   meal_nutrition; recompute-shopping still fires → shopper writes shopping_list.
4. enrich-recipe-nutrition: addRecipe (api) → nutritionist writes nutrition_facts (live).
5. getRecipeNutrition/getPlanNutrition/nutritionStats reflect it.
6. cron nightly-substitutions → optimizer writes substitutions/suggestions (live self-query).
7. Chat: <Chat sourcing/importer> "import <url>" → webFetch → recipe+recipe_ingredients inserted.
8. getShoppingTrip aisle-groups + cost; listExpiring; listSuggestions/dismiss.
Fallback to mock streamFn ONLY if AZURE key missing (record in PROGRESS).

## Fan-out (parallel Sonnet subagents by directory)
- A: database/ (6 tables + column edits to 4 existing). — orchestrator does this first (foundation), verifies validate.
- B: api/ (13 new handlers).
- C: pages/ + components/ (5 pages + 7 components + additive edits).
- D: spaces/chef remediation (full format).
- E: spaces/nutrition (full format).
- F: spaces/sourcing (full format).
- G: hooks/ (4).
Then orchestrator integrates, extends tests, runs loaders/build, live e2e, push both repos.
