# lmthing.kitchen as a Project-Application — the `kitchen` project

> A concrete instantiation of [the project-as-application model](../org/format/project/README.md) for a
> **pantry + meal planner**: the app knows what's in your pantry, plans a week of meals from your
> recipes, and generates the shopping list for exactly what you're missing. The `kitchen` project owns
> the app — `database/` (ingredients, recipes, the recipe⇄ingredient join, weekly plans, plan meals,
> shopping list), `pages/` (client React week grid / pantry / recipes / shopping), `api/` (named typed
> Node endpoints), `hooks/` (weekly cron planner + a `database` hook that recomputes the shopping list),
> and a project-scoped **`chef`** space. Read the parent plan first for the shared mechanisms
> (capability globals, typed-contract pipeline, serving); this file is the kitchen-specific shape.
> Paths are relative to the org repo root.

## Context

"What's for dinner this week?" is a small chore most people dislike but face every week — and it comes
loaded with soft constraints: what's already in the fridge, who's home, dietary needs, using things
before they spoil. This app takes it off your plate. You keep a pantry (what you have and how much) and
a recipe box; every Sunday the `chef` plans next week's meals around what you already own and what you
like, then the `shopper` **diffs the plan against your pantry** to hand you a shopping list of only the
gaps. **The value is a planned week and a correct shopping list for near-zero effort** — less decision
fatigue, less food waste, less forgetting the one thing you needed. A personal chef that actually knows
what's in your kitchen. (There is no `kitchen/` domain today — it's a net-new project-application,
served under the generic `lmthing.app/<project>/` mount.)

## The project

- **Project id**: `kitchen`. One per user pod (your pantry + your recipes = per-user data).
- **Project-scoped space**: `kitchen/spaces/chef/` — the specialists that maintain the app
  (`planner`, `shopper`, `pantry-keeper`). Because the db is **project-rooted**, all three read/write
  the **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder"); **runtime** work is the `chef` agents, driven by a weekly cron, a `database`
  hook, and chat — not THING.
- **Provisioning**: v1 seeds the `kitchen` project from a checked-in template materialized into the
  pod's `<root>/kitchen/`, pre-loaded with a handful of starter recipes. In a **later phase** it
  becomes **installable from lmthing.store** as a project app (parent plan §Risks "Distribution").

## Directory layout

```
kitchen/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, lucide-react …
├── database/
│   ├── ingredients.json        # pantry stock: what you have and how much (the "many" side of recipe_ingredients)
│   ├── recipes.json            # a recipe (title, instructions, servings)
│   ├── recipe_ingredients.json # JOIN: how much of an ingredient a recipe needs
│   ├── meal_plans.json         # one planned week
│   ├── plan_meals.json         # a recipe slotted into a day+meal of a plan
│   └── shopping_list.json      # computed gaps for a plan (required − pantry)
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: This Week · Recipes · Pantry · Shopping
│   ├── index.tsx             # "/"                    → current week's plan grid
│   ├── recipes/
│   │   ├── index.tsx         # "/recipes"             → recipe list
│   │   └── [id].tsx          # "/recipes/:id"         → recipe + its ingredients (include join)
│   ├── pantry.tsx            # "/pantry"              → pantry stock (edit quantities)
│   ├── plan/[planId].tsx     # "/plan/:planId"        → a specific week's grid
│   └── shopping.tsx          # "/shopping"            → current plan's shopping list
├── components/               # WeekGrid, MealCell, RecipeCard, IngredientRow, ShoppingRow…
├── api/
│   ├── plan/
│   │   ├── GET.ts                    # currentPlan   (include plan_meals → recipe)
│   │   ├── POST.ts                   # generatePlan  (delegates the planner, returns immediately)
│   │   └── [id]/shopping/GET.ts      # shoppingList  (join: required − pantry)
│   ├── recipes/
│   │   ├── GET.ts                    # listRecipes
│   │   ├── POST.ts                   # addRecipe
│   │   └── [id]/GET.ts               # getRecipe    (include recipe_ingredients → ingredient)
│   ├── meals/
│   │   └── [id]/
│   │       ├── PATCH.ts              # updateMeal   (swap recipe / servings / move day)
│   │       └── DELETE.ts             # removeMeal
│   ├── pantry/
│   │   ├── GET.ts                    # listPantry
│   │   ├── POST.ts                   # addIngredient
│   │   ├── low/GET.ts                # lowStock (stock at/below lowStockThreshold)
│   │   └── [id]/PATCH.ts             # updatePantry (set quantity — "used the milk")
│   ├── shopping/
│   │   └── [id]/PATCH.ts             # toggleBought (mark a shopping row bought → adds to pantry)
│   └── stats/GET.ts                  # kitchenStats (dashboard counts for the home grid)
├── hooks/
│   ├── plan-week.ts          # cron  Sun 18:00 → chef/planner#plan
│   └── recompute-shopping.ts # database plan_meals:insert|update|remove → chef/shopper#recompute
├── spaces/
│   └── chef/                 # project-scoped space (agents / tasklists / knowledge)
│       └── agents/{planner,shopper,pantry-keeper}/instruct.md
├── types/generated.d.ts      # GENERATED — row + endpoint I/O types (incl. relation fields)
└── .data/
    ├── app.db                # SQLite (WAL)
    ├── app.sql               # backup dump
    └── hooks-state.json      # cron last-run / pending queue
```

## Database (schemas — descriptions mandatory, FKs + relations)

Kitchen is the **relations-heavy** example: a classic many-to-many (`recipes` ↔ `ingredients` through
`recipe_ingredients`), plus `meal_plans` → `plan_meals` → `recipes`. Every table and column carries a
required `description`; the loader fails loud on any missing one. `relations` generate typed navigation
fields **and** power `db.query(…, { include })` (a join under the hood) — which is how the shopper's
diff is one call, not N+1 reads.

```json
// database/ingredients.json — the pantry (the "many" side of recipe_ingredients)
{ "title": "Ingredients",
  "description": "One pantry ingredient the household stocks, with how much is currently on hand.",
  "columns": {
    "id":                { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "name":              { "type": "string", "description": "ingredient name, e.g. 'olive oil'; dedupe key", "required": true, "unique": true },
    "category":          { "type": "string", "description": "grocery aisle grouping, e.g. 'produce' | 'dairy' | 'pantry'" },
    "unit":              { "type": "string", "description": "the unit stock/needs are measured in, e.g. 'g' | 'ml' | 'count'", "required": true },
    "quantity":          { "type": "number", "description": "how much is currently in the pantry, in `unit`", "default": 0 },
    "lowStockThreshold": { "type": "number", "description": "restock hint: below this, the planner treats it as unavailable", "default": 0 },
    "updatedAt":         { "type": "date",   "description": "when the pantry quantity was last changed", "generated": "now" } },
  "relations": {
    "usedIn":   { "hasMany": "recipe_ingredients", "via": "ingredientId", "description": "recipes that call for this ingredient" },
    "shopping": { "hasMany": "shopping_list",       "via": "ingredientId", "description": "shopping rows for this ingredient" } } }
```

```json
// database/recipes.json
{ "title": "Recipes",
  "description": "A recipe the household can cook — instructions plus the set of ingredient quantities it needs.",
  "columns": {
    "id":          { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "title":       { "type": "string", "description": "recipe name shown in the list", "required": true },
    "description": { "type": "string", "description": "one-line summary shown on the card" },
    "instructions":{ "type": "string", "description": "full method, markdown", "required": true },
    "servings":    { "type": "number", "description": "how many servings the ingredient quantities are for", "default": 2 },
    "prepMinutes": { "type": "number", "description": "rough total time in minutes", "default": 30 },
    "tags":        { "type": "json",   "description": "array of tag strings — 'vegetarian', 'quick', cuisine…" },
    "imageUrl":    { "type": "string", "description": "optional hero image URL shown on the recipe card and detail page" },
    "source":      { "type": "string", "description": "where it came from (url or 'chef')" } },
  "relations": {
    "ingredients": { "hasMany": "recipe_ingredients", "via": "recipeId", "description": "the ingredient quantities this recipe needs" },
    "meals":       { "hasMany": "plan_meals",         "via": "recipeId", "description": "plan slots using this recipe" } } }
```

```json
// database/recipe_ingredients.json — the JOIN table (recipe ⇄ ingredient, with quantity)
{ "title": "Recipe ingredients",
  "description": "One line of a recipe: how much of a given ingredient the recipe needs. The bridge between recipes and pantry ingredients.",
  "columns": {
    "id":           { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "recipeId":     { "type": "string",  "description": "the recipe this line belongs to", "required": true,
                      "references": { "table": "recipes", "column": "id", "onDelete": "cascade" } },
    "ingredientId": { "type": "string",  "description": "the pantry ingredient needed", "required": true,
                      "references": { "table": "ingredients", "column": "id", "onDelete": "restrict" } },
    "quantity":     { "type": "number",  "description": "how much is needed, in the ingredient's unit, for the recipe's `servings`", "required": true },
    "optional":     { "type": "boolean", "description": "whether the recipe works without it (excluded from the shopping diff)", "default": false } },
  "relations": {
    "recipe":     { "belongsTo": "recipes",     "via": "recipeId",     "description": "the recipe" },
    "ingredient": { "belongsTo": "ingredients", "via": "ingredientId", "description": "the pantry ingredient" } } }
```

```json
// database/meal_plans.json
{ "title": "Meal plans",
  "description": "One planned week of meals. The current plan is the most recent by weekStart.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "weekStart": { "type": "date",   "description": "Monday of the planned week; one plan per week", "required": true, "unique": true },
    "status":    { "type": "string", "description": "'planning' while the chef fills it, 'ready' when done", "default": "planning" },
    "createdAt": { "type": "date",   "description": "when the plan was generated", "generated": "now" } },
  "relations": {
    "meals":    { "hasMany": "plan_meals",    "via": "planId", "description": "the recipes slotted into this week" },
    "shopping": { "hasMany": "shopping_list", "via": "planId", "description": "the computed shopping list for this week" } } }
```

```json
// database/plan_meals.json
{ "title": "Plan meals",
  "description": "A recipe slotted into a specific day and meal of a weekly plan.",
  "columns": {
    "id":       { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "planId":   { "type": "string", "description": "the week this slot is in", "required": true,
                  "references": { "table": "meal_plans", "column": "id", "onDelete": "cascade" } },
    "recipeId": { "type": "string", "description": "the recipe cooked in this slot", "required": true,
                  "references": { "table": "recipes", "column": "id", "onDelete": "restrict" } },
    "day":      { "type": "date",   "description": "the calendar day of this meal", "required": true },
    "meal":     { "type": "string", "description": "'breakfast' | 'lunch' | 'dinner'", "required": true },
    "servings": { "type": "number", "description": "servings to cook (scales the recipe's ingredient quantities)", "default": 2 } },
  "relations": {
    "plan":   { "belongsTo": "meal_plans", "via": "planId",   "description": "the week" },
    "recipe": { "belongsTo": "recipes",    "via": "recipeId", "description": "the recipe cooked" } } }
```

```json
// database/shopping_list.json — computed gaps (required − pantry)
{ "title": "Shopping list",
  "description": "One line of a plan's shopping list: an ingredient the week needs more of than the pantry has.",
  "columns": {
    "id":           { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "planId":       { "type": "string",  "description": "the plan this list is for", "required": true,
                      "references": { "table": "meal_plans", "column": "id", "onDelete": "cascade" } },
    "ingredientId": { "type": "string",  "description": "the ingredient to buy", "required": true,
                      "references": { "table": "ingredients", "column": "id", "onDelete": "cascade" } },
    "quantity":     { "type": "number",  "description": "how much to buy (required by the week minus pantry stock), in the ingredient's unit", "required": true },
    "bought":       { "type": "boolean", "description": "whether the user has bought it (checking it off tops up the pantry)", "default": false } },
  "relations": {
    "plan":       { "belongsTo": "meal_plans",  "via": "planId",       "description": "the week" },
    "ingredient": { "belongsTo": "ingredients", "via": "ingredientId", "description": "the ingredient to buy" } } }
```

- **`recipe_ingredients` is the classic through-table** — `Recipe.ingredients` and
  `Ingredient.usedIn` both point at it, and generated types give
  `Recipe & { ingredients: (RecipeIngredient & { ingredient: Ingredient })[] }` from a single
  `db.query('recipes', { where:{id}, include: ['ingredients'] })` with a nested `include` on
  `ingredient`. This two-hop join is the read every recipe/plan/shopping page depends on.
- **`onDelete` is deliberate**: `recipe_ingredients.ingredientId` is `restrict` (you can't delete an
  ingredient a recipe still needs) while `recipeId` is `cascade` (deleting a recipe drops its lines);
  `plan_meals.recipeId` is `restrict` (a recipe used this week can't vanish under the plan).
- **The shopping diff is a join, not a loop** — `shoppingList` reads the plan's `plan_meals` →
  `recipe` → `recipe_ingredients` → `ingredient` in `include`d queries, sums required quantities per
  ingredient (scaled by `servings`), subtracts pantry `quantity`, and writes the positive gaps. One
  call graph, no N+1.

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders. Relation
fields arrive typed, so a recipe page renders its ingredient lines with no extra fetch.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `currentPlan` (include meals → recipe) |
| `pages/recipes/index.tsx` | `/recipes` | `listRecipes` |
| `pages/recipes/[id].tsx` | `/recipes/:id` | `getRecipe` (include ingredients → ingredient) |
| `pages/pantry.tsx` | `/pantry` | `listPantry` + `lowStock`; `updatePantry`/`addIngredient` |
| `pages/plan/[planId].tsx` | `/plan/:planId` | `currentPlan`-shaped for a specific week; `updateMeal` on swap |
| `pages/shopping.tsx` | `/shopping` | `shoppingList`; `toggleBought` |

The home week-grid (`index.tsx`) also reads `kitchenStats` and renders a small counts strip
(recipes · pantry items · low-stock · planned meals · shopping gaps) above the grid — a cheap
at-a-glance dashboard, the same "pages are a live read view" pattern as the rest of the app.

```tsx
// pages/recipes/[id].tsx  → "/recipes/:id"
import type { Recipe, RecipeIngredient, Ingredient } from '../../types/generated'
import { useApi } from '@app/runtime'
import { IngredientRow } from '../../components/IngredientRow'

type FullRecipe = Recipe & { ingredients: (RecipeIngredient & { ingredient: Ingredient })[] }

export default function RecipePage({ params }: { params: { id: string } }) {
  const { data: recipe, isLoading } = useApi('getRecipe', { id: params.id })  // typed FullRecipe
  if (isLoading) return <Spinner />
  return (
    <article>
      <h1>{recipe.title}</h1>
      <ul>
        {recipe.ingredients.map((ri) => (
          <IngredientRow key={ri.id} qty={ri.quantity} unit={ri.ingredient.unit} name={ri.ingredient.name} />
        ))}
      </ul>
      <MarkdownBody source={recipe.instructions} />
    </article>
  )
}
```

- The week grid (`index.tsx`) reads `currentPlan` — `MealPlan & { meals: (PlanMeal & { recipe: Recipe })[] }`
  — and lays recipes into a day × meal grid; the `include` means the recipe titles render without a
  per-cell fetch.
- While `plan.status === 'planning'` the page polls `currentPlan` so meals appear live as the planner
  writes `plan_meals` (same "pages are a live read view" property as blog).

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + default
handler `(input, { db, delegate, apiCall })`. Dual-addressed (HTTP for the browser, `name` for
agents via `apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `currentPlan` | `GET api/plan` | `{}` → `MealPlan & { meals: (PlanMeal & { recipe })[] }` |
| `generatePlan` | `POST api/plan` | `{ weekStart? }` → `{ planId, status:'planning' }` |
| `shoppingList` | `GET api/plan/:id/shopping` | `{ id }` → `(ShoppingList & { ingredient })[]` |
| `listRecipes` | `GET api/recipes` | `{ tag? }` → `Recipe[]` |
| `addRecipe` | `POST api/recipes` | `{ title, instructions, ingredients:[{name,quantity,unit}] }` → `Recipe` |
| `getRecipe` | `GET api/recipes/:id` | `{ id }` → `Recipe & { ingredients: (RecipeIngredient & { ingredient })[] }` |
| `updateMeal` | `PATCH api/meals/:id` | `{ id, recipeId?, day?, servings? }` → `PlanMeal` |
| `removeMeal` | `DELETE api/meals/:id` | `{ id }` → `{ ok }` |
| `listPantry` | `GET api/pantry` | `{}` → `Ingredient[]` |
| `lowStock` | `GET api/pantry/low` | `{}` → `Ingredient[]` (stock at/below `lowStockThreshold`) |
| `addIngredient` | `POST api/pantry` | `{ name, unit, quantity?, category? }` → `Ingredient` |
| `updatePantry` | `PATCH api/pantry/:id` | `{ id, quantity }` → `Ingredient` |
| `toggleBought` | `PATCH api/shopping/:id` | `{ id, bought }` → `{ ok }` |
| `kitchenStats` | `GET api/stats` | `{}` → `{ recipes, pantryItems, lowStock, plannedMeals, shoppingGaps }` |

> **Row-type note (engine truth).** The generated row-interface name is the engine's deterministic
> singularizer (`build/schema.ts`): `shopping_list → ShoppingList` (the last word `list` ends in
> `t`, so it is left unchanged — it is **not** `ShoppingItem`). Pages and handlers import
> `ShoppingList` from `@app/types`. Likewise `meal_plans → MealPlan`, `plan_meals → PlanMeal`,
> `recipe_ingredients → RecipeIngredient`.

```ts
// api/plan/[id]/shopping/GET.ts → GET .../api/plan/:id/shopping ; name "shoppingList"
/** Compute (and return) the shopping list for a plan: everything the week needs beyond the pantry. */
export const name = 'shoppingList'
export const description = "The plan's shopping list — required ingredient quantities minus current pantry stock."

export interface Input  { /** plan id */ id: string }
export interface Output { items: Array<{ ingredient: string; unit: string; quantity: number; bought: boolean }> }

export default function handler(input: Input, ctx: { db: DbApi }): Output {
  // One include-graph, not N+1: plan → meals → recipe → recipe_ingredients → ingredient.
  const plan = ctx.db.query('meal_plans', {
    where: { id: input.id },
    include: ['meals'],                     // each meal carries its recipe.ingredients.ingredient
  })[0]
  const need = new Map<string, { unit: string; qty: number }>()
  for (const meal of plan.meals) {
    const recipe = ctx.db.query('recipes', { where: { id: meal.recipeId }, include: ['ingredients'] })[0]
    const scale = meal.servings / recipe.servings
    for (const ri of recipe.ingredients) {
      if (ri.optional) continue
      const cur = need.get(ri.ingredientId) ?? { unit: ri.ingredient.unit, qty: 0 }
      cur.qty += ri.quantity * scale
      need.set(ri.ingredientId, cur)
    }
  }
  const items = [...need.entries()].flatMap(([ingredientId, n]) => {
    const have = ctx.db.query('ingredients', { where: { id: ingredientId } })[0].quantity
    const gap = n.qty - have
    return gap > 0 ? [{ ingredient: ingredientId, unit: n.unit, quantity: gap, bought: false }] : []
  })
  return { items }
}
```

- `shoppingList` is the doc's **join centrepiece** — a diff over `include`d relations. (The `shopper`
  agent runs the same logic to *persist* `shopping_list` rows; the handler is the read path.)
- `toggleBought` marking a row bought **tops up the pantry** (`updatePantry` on that ingredient) — a
  write that a curator-style agent could also do, but here the UI drives it.

## Hooks

```ts
// hooks/plan-week.ts — build next week every Sunday evening
export default {
  type: 'cron',
  daily: '18:00',                                   // fires daily; the planner no-ops unless it's Sunday
  trigger: 'chef/planner#plan',                     // declarative: run the planner
  budget: { maxEpisodes: 15, maxWallClockMs: 600000 },
}
```

```ts
// hooks/recompute-shopping.ts — keep the shopping list in sync with the plan
export default {
  type: 'database',
  on: { table: 'plan_meals', event: 'insert' },     // (also wired for update/remove)
  budget: { maxEpisodes: 6 },
  handler: async ({ row, delegate }) => {
    await delegate('chef/shopper', 'recompute', { input: { planId: row.planId } })
  },
}
```

- **The loop is bounded**: `plan-week` → planner writes `plan_meals` → each insert fires
  `recompute-shopping` → shopper writes `shopping_list`. No hook watches `shopping_list`, and
  **self-write exclusion** means the shopper's own writes don't re-fire it; **per-hook coalesce**
  collapses the burst of `plan_meals` inserts from one planning run into a single recompute (parent
  plan §Safety). The planner writing seven days of meals triggers *one* shopping recompute, not seven.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/kitchen/hooks/plan-week/run`); a Sunday missed while the pod was down runs once
  via boot catch-up; local dev uses the in-process fallback tick.

## Chat (co-cooking)

One drop-in `<Chat agent="chef/pantry-keeper" />` widget, reusing the always-available multisession WS
endpoint (parent plan §Chat) — the binding is a runtime prop, no `chats/` dir:

- On `/pantry` → `<Chat agent="chef/pantry-keeper" />`. The user talks their pantry up to date — "used
  the last of the milk, bought 500g pasta" — and the keeper `db.update`s `ingredients`. Because that's
  a first-class write, the next `generatePlan` sees the real stock. Chat is a **live control surface**
  (parent plan §Chat): "plan around what I have, we're vegetarian this week" → the planner runs → the
  week grid updates.
- History persists at `kitchen/spaces/chef/sessions/<id>` (project-session snapshot form, resumable).
  This is **the one place the catalog descriptor renderer re-enters the app** — pages stay real React.

## The `chef` space (agents + capabilities)

Project-scoped at `kitchen/spaces/chef/`. Capabilities are least-privilege per agent — one
config-bearing `capabilities:` frontmatter key, table scope **per verb** (parent plan §"Capability
globals"):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **planner** | `recipes, recipe_ingredients, ingredients, meal_plans, plan_meals` | `meal_plans, plan_meals` | — (round 1: db-only) | pick recipes for the week (respecting pantry + tags); write the plan (a `forEach` over days) |
| **shopper** | `plan_meals, recipes, recipe_ingredients, ingredients` | `shopping_list` | — | diff week-required vs pantry (the join) → write `shopping_list` gaps |
| **pantry-keeper** | `ingredients` | `ingredients` | — | chat: keep pantry stock accurate; add new ingredients |

> **Round 1 = db-only chef.** With no external-binding registry in the shipped engine (§Notes), the
> planner plans from the seeded recipe box using its `db:read` only; the web-search-driven recipe
> `importer` (with `functions: [webFetch]`) is a round-2 Additional feature. The frontmatter below
> therefore carries no `api:call` for round 1.

```yaml
# kitchen/spaces/chef/agents/planner/instruct.md frontmatter (round 1: db-only)
capabilities:
  - db:read:  { tables: [recipes, recipe_ingredients, ingredients, meal_plans, plan_meals] }
  - db:write: { tables: [meal_plans, plan_meals] }        # writes the week; never touches pantry or shopping
  # round 2 (Additional features): the importer gains `functions: [webFetch]` to pull recipes from URLs
```

```yaml
# kitchen/spaces/chef/agents/shopper/instruct.md frontmatter — reads wide, writes one table
capabilities:
  - db:read:  { tables: [plan_meals, recipes, recipe_ingredients, ingredients] }
  - db:write: { tables: [shopping_list] }
```

- **Per-verb table scope keeps lanes clean on a heavily-joined db** — the shopper *reads four tables*
  to compute the diff but can only *write* `shopping_list`; the planner can't touch the pantry or the
  shopping list; the pantry-keeper only touches `ingredients`. This is exactly the parent plan's
  "read wide, write narrow" pattern, and it's most visible in an app where everything joins to
  everything.
- **The planner's `plan` tasklist uses a `forEach` over the seven days** — the host runs one slotting
  pass per day (parallel, within the fork cap), each writing that day's `plan_meals`; the model never
  writes the loop (parent plan gotcha). Recipe reads inside each day use `include` to see ingredient
  quantities so the planner can honour "quick weeknights" without a second query.
- **No `db:schema`/`pages:write`/`api:write` here** — the chef *operates* the app. "Add a 'leftovers'
  meal type" or "a nutrition column" is an authoring request → THING → `system-appbuilder`.
- `recipeSearch`/`webSearch` are **named bindings** (hidden URL+key kept out of the transcript); the
  allowlisted set is each agent's callable-tool menu.

## Serving & domains

- **Local CLI**: `localhost:8080/app/kitchen/…` (pages) and `localhost:8080/app/kitchen/api/<name>` —
  the parent plan's mount, `<project>` = `kitchen`.
- **Prod**: served under the **generic authenticated `lmthing.app` domain** at `lmthing.app/kitchen/*`
  → the authenticated user's pod `/app/kitchen/*` (Envoy JWT + per-user routing). No pre-existing
  static SPA to replace and no friendly product alias in v1 — kitchen rides the generic app plane; a
  `lmthing.kitchen` alias is an optional later edge-alias.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/kitchen/app` (manifest, data browser,
  manual hook run, build status, live preview iframe of `…/app/kitchen/`).

**No public/shared surface** — every route and endpoint is an authenticated, per-user pod read/write;
the app stays fully within per-user pod isolation, so no v1 deviation from the parent plan.

## Additional features (more user value)

A meal plan is only worth anything if it fits *your* kitchen, tastes, and constraints — and if filling
the recipe box isn't a chore. These features are what make the plan trustworthy enough to cook from.
Each is **additive** on the same engine.

### Dietary preferences & household — the plan actually fits you
The single biggest quality lever: a plan that ignores an allergy or your household size is worse than none.
- **Data**: `settings` (single row) — `householdSize`, `diet` (`none`|`vegetarian`|`vegan`|`pescatarian`|…),
  `allergies` (json), `dislikes` (json ingredient names), `cuisines` (json preferred), `maxPrepMinutes`
  (weeknight time cap).
- **Agents**: the `planner` gains `db:read: settings` and **must** hard-filter on allergies/diet, avoid
  `dislikes`, prefer liked `cuisines`, and scale `plan_meals.servings` to `householdSize`.
- **Pages**: a `/preferences` page.

### Reduce waste — cook what's about to expire
Waste reduction is the headline household benefit; this makes it active, not passive.
- **Data**: add `expiresAt` to `ingredients`.
- **Agent**: the `planner` scores recipes up when they consume soon-to-expire stock.
- **Hook**: `use-it-up.ts` — `cron daily` → `chef/planner#suggest-uses` surfaces items expiring in
  ≤3 days with a recipe that uses them.

### Import a recipe from a URL — kill the onboarding chore
Filling the recipe box is the main barrier to value; paste-a-link removes it.
- **API**: `importRecipe` `POST api/recipes/import` `{ url }` → delegates a `chef/importer` that
  `webFetch`s the page, parses title/ingredients/steps, and `db.insert`s `recipes` +
  `recipe_ingredients` (matching or creating `ingredients`).
- **Agent**: `importer` (`db:read ingredients` / `db:write recipes,recipe_ingredients,ingredients`,
  `api:call [webFetch]`). Also reachable as `<Chat agent="chef/importer">` ("add my grandma's lasagna").

### Learn your favorites — ratings
The plan should get better every week, not stay static.
- **Data**: add `rating` (1–5, nullable) + `cookedAt` to `plan_meals`.
- **API**: `rateMeal` `PATCH api/meals/:id/rating`.
- **Agent**: the `planner` reads past ratings to favor winners, retire flops, and avoid repeating a
  recipe cooked in the last N weeks (variety).

## Round 2 — Nutrition, Sourcing & Kitchen Intelligence (expansion)

Round 1 shipped the core loop (pantry → weekly plan → shopping diff). Round 2 turns kitchen from a
*planner* into a **kitchen-intelligence system**: it now knows the **nutrition** of what you cook,
**sources** recipes for you (paste a URL) and **optimizes** the shop (aisle order, cost, substitutions),
and proactively **surfaces suggestions** (use up what's about to expire, swap out-of-stock items). This
adds two whole new specialist teams alongside `chef` — a `nutrition` team and a `sourcing` team — all
reading/writing the **same** project-rooted db (the multi-agent-application shape at full strength).
Everything here is **additive** on the same engine; round-1 tables/endpoints/agents are unchanged.

### New database tables (6) & columns

| Table | Row type | Purpose |
|---|---|---|
| `settings` | `Setting` | single-row household + dietary prefs: `householdSize`, `diet`, `allergies` (json), `dislikes` (json), `cuisines` (json), `maxPrepMinutes`, `calorieTarget`, `proteinTarget` |
| `nutrition_facts` | `NutritionFact` | per-ingredient nutrition **per one `unit`**: `ingredientId` (FK, unique), `caloriesPerUnit`, `proteinPerUnit`, `carbsPerUnit`, `fatPerUnit`, `basisNote` |
| `meal_nutrition` | `MealNutrition` | computed nutrition for one `plan_meals` slot: `planMealId` (FK, unique), `calories`, `protein`, `carbs`, `fat` |
| `substitutions` | `Substitution` | suggested swap for an ingredient: `ingredientId` (FK), `substituteName`, `ratio`, `reason` (`out-of-stock`\|`expiring`\|`cost`\|`dietary`), `note` |
| `shopping_trips` | `ShoppingTrip` | an aisle-organized, cost-estimated shop for a plan: `planId` (FK), `store`, `estimatedCost`, `organized` (json: `[{aisle, lines:[…]}]`), `status` |
| `suggestions` | `Suggestion` | a proactive card surfaced to the user: `type` (`use-it-up`\|`substitution`\|`nutrition`), `title`, `body`, `ingredientId?`/`recipeId?` (FK, setNull), `priority`, `dismissed`, `createdAt` |

New **columns** on existing tables (additive `db.addColumn` on boot): `ingredients.expiresAt` (date,
nullable — waste), `ingredients.costPerUnit` (number, default 0 — cost estimate), `recipes.cuisine`
(string, nullable — preference filtering), `plan_meals.rating` (number 1–5, nullable — learning) and
`plan_meals.cookedAt` (date, nullable). Relations: `ingredients.nutrition → nutrition_facts` (hasMany),
`ingredients.substitutes → substitutions` (hasMany), `meal_plans.trips → shopping_trips` (hasMany),
`plan_meals.nutrition → meal_nutrition` (hasMany), plus the `belongsTo` back-links.

### New API endpoints (13) — → **27 total**

| name | method + route | I/O sketch |
|---|---|---|
| `getSettings` | `GET api/settings` | `{}` → `Setting` (seeds the single default row if absent) |
| `updateSettings` | `PATCH api/settings` | `{ householdSize?, diet?, allergies?, dislikes?, cuisines?, maxPrepMinutes?, calorieTarget?, proteinTarget? }` → `Setting` |
| `importRecipe` | `POST api/recipes/import` | `{ url }` → `{ recipeId, status:'importing' }` (creates a stub recipe, spawns `sourcing/importer`) |
| `rateMeal` | `PATCH api/meals/:id/rating` | `{ id, rating }` → `PlanMeal` |
| `markCooked` | `POST api/meals/:id/cooked` | `{ id }` → `PlanMeal` (sets `cookedAt`) |
| `getRecipeNutrition` | `GET api/recipes/:id/nutrition` | `{ id }` → `{ calories, protein, carbs, fat, perServing, missing:[names] }` (sums `nutrition_facts` over the recipe's lines) |
| `getPlanNutrition` | `GET api/plan/:id/nutrition` | `{ id }` → `{ days:[{day, calories, protein, carbs, fat}], targets, adherence }` |
| `listExpiring` | `GET api/pantry/expiring` | `{ withinDays? }` → `Ingredient[]` (non-null `expiresAt` within N days) |
| `getShoppingTrip` | `GET api/plan/:id/trip` | `{ id }` → `{ aisles:[{aisle, lines:[{ingredient,unit,quantity,estCost}]}], estimatedCost }` (deterministic aisle-group + cost of the gaps) |
| `listSubstitutions` | `GET api/substitutions/:ingredientId` | `{ ingredientId }` → `(Substitution & { ingredient })[]` |
| `nutritionStats` | `GET api/nutrition/stats` | `{}` → `{ weekCalories, weekProtein, avgPerDay, target, onTrack }` |
| `listSuggestions` | `GET api/suggestions` | `{ type? }` → `(Suggestion & { ingredient?, recipe? })[]` (undismissed, by priority) |
| `dismissSuggestion` | `PATCH api/suggestions/:id` | `{ id }` → `{ ok }` |

- The **deterministic** work stays in handlers (`getRecipeNutrition`/`getPlanNutrition` sum
  `nutrition_facts`; `getShoppingTrip` groups the diff by `ingredients.category` and multiplies
  `costPerUnit` — same "read-view is handler code, the agent persists" split as round-1's `shoppingList`).
  The **judgement** work (parse a messy recipe page, pick a sensible substitute, write a coaching note)
  is the new agents.
- `importRecipe` follows the round-1 `generatePlan` pattern: it creates a stub `recipes` row
  (`status`/`source:url`) and fires `sourcing/importer` fire-and-forget (`spawn` is a P6 stub in the
  shipped engine → the **live** import path is `<Chat agent="sourcing/importer">` on `/import`, exactly
  as round-1's live planner path is chat/hook, not api `spawn`).

### New hooks (4) — → **6 total** (each fires on a path that actually dispatches)

| Hook | Type | Trigger | Fires because |
|---|---|---|---|
| `compute-nutrition.ts` | `database` `plan_meals:insert` | `nutrition/nutritionist#compute` | the planner writes `plan_meals` in a **top-level/chat** session (main-process write → dispatches) |
| `enrich-recipe-nutrition.ts` | `database` `recipes:insert` | `nutrition/nutritionist#analyze-recipe` | `addRecipe`/`importRecipe` are **api** handlers (main-process write → dispatches) |
| `use-it-up.ts` | `cron` `daily` | `chef/planner#suggest-uses` | cron → hook-run endpoint (always dispatches; agent self-queries) |
| `nightly-substitutions.ts` | `cron` `daily` | `sourcing/optimizer#substitutions` | cron (agent self-queries low/expiring/out-of-stock stock) |

- **Loop-boundedness** (parent §Safety): `compute-nutrition` writes `meal_nutrition` (no hook) and
  `enrich-recipe-nutrition` writes `nutrition_facts` (no hook) — neither cascades. The `plan_meals:insert`
  burst from a planning run **coalesces** into one `compute-nutrition` run (as it already does for
  `recompute-shopping`). The two cron hooks self-query and write `suggestions`/`substitutions` (no hook)
  — terminal. No hook watches `suggestions`/`substitutions`/`meal_nutrition`/`shopping_trips`.
- **Self-query, not passed input** (engine truth): hook `delegate` drops structured input and api `spawn`
  is a P6 no-op, so every hook-invoked action **self-queries** the db for its work (e.g. `compute`
  finds `plan_meals` whose `meal_nutrition` is missing; `suggest-uses` finds `ingredients` with a near
  `expiresAt`; `substitutions` finds out-of-stock/expiring/expensive ingredients).

### The `nutrition` space (new specialist team — full format)

Project-scoped at `kitchen/spaces/nutrition/`. Least-privilege per verb.

| Agent | `db:read` | `db:write` | Role |
|---|---|---|---|
| **nutritionist** | `recipes, recipe_ingredients, ingredients, plan_meals, meal_plans, nutrition_facts, settings` | `meal_nutrition, nutrition_facts, suggestions` | estimate per-ingredient `nutrition_facts`; roll them up per meal into `meal_nutrition`; flag a day far off `calorieTarget`/`proteinTarget` as a `nutrition` suggestion |
| **coach** | `settings, meal_plans, plan_meals, recipes, meal_nutrition, nutrition_facts, suggestions` | `settings, suggestions` | chat: help the user set goals/diet/household; explain the week's nutrition in plain language; **not a dietitian** framing |

- `nutritionist` estimates nutrition from ingredient identity (name + category + unit) — a heuristic
  `estimateNutrition` space function seeds a first pass; the agent refines with its
  `nutrition-science` knowledge. Deterministic roll-ups (sum lines × servings) are functions; the
  estimate itself is the judgement.

### The `sourcing` space (new specialist team — full format)

Project-scoped at `kitchen/spaces/sourcing/`.

| Agent | `db:read` | `db:write` | Extra | Role |
|---|---|---|---|---|
| **importer** | `ingredients, recipes` | `recipes, recipe_ingredients, ingredients` | web via **task-level** `functions:` (not agent-level) | fetch a recipe URL, parse title/ingredients/steps, find-or-create `ingredients`, insert `recipes` + `recipe_ingredients` |
| **optimizer** | `shopping_list, ingredients, meal_plans, plan_meals, recipes, recipe_ingredients, substitutions, settings, suggestions` | `shopping_trips, substitutions, suggestions` | — | organize a plan's shopping list by aisle + estimate cost into `shopping_trips`; suggest substitutes for out-of-stock/expiring/expensive items |

- **importer** is the first kitchen agent to touch the web — via the **universal system globals**
  `webFetch`/`webSearch`/`fetch` (there is **no** external-binding registry; `api:call` is reserved for
  the app's own endpoints — see §Notes). **Engine truth (verified live 2026-07-05):** these globals are
  *ambient/universal* at the agent's top level and must **not** appear in an agent's `instruct.md`
  `functions:` block — that block is validated fail-loud against real files in `functions/`, so listing a
  system global there throws "not found in functions/" at space load. They belong in a **task-level**
  `functions:` allowlist (the import tasklist's fetch task lists them, which is where a restricted task
  regains them). Agent-level `functions:` on the importer therefore lists only real space functions
  (`parseRecipe`, `matchIngredient`). The importer never invents an ingredient it didn't parse; a page it
  can't fetch/parse leaves the stub recipe flagged, not filled with fabrication.

### Chef space — full-format remediation (required)

Round 1 shipped `chef` as `agents/` + `charter.md` only. Round 2 brings it to the **full space format**
that `sourcing`/`nutrition` are born with: `tasklists/` (planner's day-`forEach` `plan` + `suggest-uses`;
shopper's `recompute`), `functions/` (the diff/scale/scoring helpers the agents call instead of
re-deriving in prose), `components/` (catalog previews for chat), and **extensive `knowledge/`**
(meal-planning, pantry-management, shopping — each a field with an `index.md` overview + ≥2 aspect
deep-dives). The planner also gains `db:read: settings` (dietary hard-filtering) + `db:write:
suggestions` and a `suggest-uses` action.

### New pages (5) — → **13 total** (design tokens only)

| File | Route | Reads / writes |
|---|---|---|
| `pages/preferences.tsx` | `/preferences` | `getSettings` + `updateSettings`; `<Chat agent="nutrition/coach">` |
| `pages/nutrition.tsx` | `/nutrition` | `getPlanNutrition` + `nutritionStats` — per-day macro bars vs targets |
| `pages/import.tsx` | `/import` | `importRecipe`; `<Chat agent="sourcing/importer">` |
| `pages/trip/[planId].tsx` | `/trip/:planId` | `getShoppingTrip`; `<Chat agent="sourcing/optimizer">` |
| `pages/expiring.tsx` | `/expiring` | `listExpiring` + `listSuggestions` + `dismissSuggestion` |

The nav (`_layout.tsx`) grows the new destinations; the home grid additively gains a **suggestions
strip** (`listSuggestions`) and the recipe detail page a **nutrition panel** (`getRecipeNutrition`) —
additive edits, round-1 behaviour preserved.

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Kitchen-specific work on top:

1. **Schemas** — the six `database/*.json`; verify the many-to-many resolves (`recipes` ↔
   `recipe_ingredients` ↔ `ingredients`) and `meal_plans` → `plan_meals` → `recipes`, required
   descriptions pass the fail-loud loader; row + relation types generate with the **nested `include`
   shapes** (`Recipe.ingredients[].ingredient`).
2. **`chef` space** — the three agents' `instruct.md` (config-bearing `capabilities:` — read-wide/
   write-narrow, per-verb `tables`) plus the planner's day-`forEach` `plan` tasklist and the shopper's
   `recompute` (the join diff); `recipeSearch`/`webSearch` named bindings registered.
3. **API** — the twelve endpoints; `getRecipe`/`currentPlan`/`shoppingList` exercise `include`;
   `generatePlan` delegates fire-and-forget.
4. **Hooks** — `plan-week` (cron daily, Sunday-gated) + `recompute-shopping` (database:insert on
   `plan_meals`); confirm the plan→shopping loop is bounded (coalesce collapses a week's inserts to
   one recompute; self-write exclusion on `shopping_list`).
5. **Pages** — week grid, recipe (join render), pantry (+ keeper chat), shopping; wire `useApi` + the
   `<Chat agent="chef/pantry-keeper">` widget; keep the design-system token gate (no raw colors).
6. **Serving** — seed each pod's `kitchen` project from the checked-in template (with starter recipes);
   serve under generic `lmthing.app/kitchen/*`; Studio manages it under `/api/projects/kitchen/app`.
7. **Additional features** — preferences/household + dietary filtering, expiry/use-it-up, recipe
   import from URL, meal ratings (see §"Additional features"); each is additive (new `settings`/
   columns/endpoints/hook + `importer` agent), shippable after the core loop.
8. **Round 2 — Nutrition, Sourcing & Kitchen Intelligence** (see §"Round 2") — the two new specialist
   teams (`nutrition`, `sourcing`), 6 new tables + 5 new columns, 13 new endpoints, 4 new hooks, 5 new
   pages, and the chef full-format remediation. Strictly additive on the round-1 core loop.
9. **Docs** — fold into `org/format/project/` as a worked example.

## Verification (end-to-end, local)

1. Load the `kitchen` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts`
   has `Ingredient`/`Recipe`/`RecipeIngredient`/`MealPlan`/`PlanMeal`/`ShoppingList` with relation
   fields, including the nested `Recipe.ingredients: (RecipeIngredient & { ingredient: Ingredient })[]`.
2. `lmthing serve`; `GET localhost:8080/app/kitchen/recipes/<id>` renders a recipe with its ingredient
   lines from a **single** `getRecipe` `include` call (no per-line fetch in the network log).
3. `addRecipe` + `addIngredient` to seed; `generatePlan` (mock streamFn): the planner `forEach`-slots
   seven days of `plan_meals` → the burst of inserts **coalesces** into **one** `recompute-shopping`
   run → `shopping_list` holds only the gaps (required − pantry); the shopping page shows them.
4. Set a pantry `quantity` high via `updatePantry` and re-run `generatePlan` → that ingredient drops
   off / shrinks in the shopping list (the diff respects stock).
5. `toggleBought` a shopping row → the pantry `quantity` tops up; a subsequent recompute reflects it.
6. `apiCall('getRecipe', { id: 5 })` with `id` as a number **fails the agent typecheck** (DTS
   overload); an un-allowlisted `apiCall` name → host error naming allowed names; the shopper writing
   `plan_meals` (not in its `db:write`) → host error naming its allowed tables.
7. Chat: `<Chat agent="chef/pantry-keeper">` "used the last of the milk" → `ingredients.milk.quantity`
   drops; history under `kitchen/spaces/chef/sessions/`.
8. cron `plan-week` (test with a `every:'5m'` variant, local fallback tick): restart → one boot
   catch-up run; immediate second restart → no double-run; budget-exhausted → single coalesced pending
   entry, runs on the next attempt after the window rolls.
9. Backup: `app.sql` + schemas + pages + api + hooks + chef space committed; `**/sessions/` not;
   restore rebuilds `app.db` from `app.sql` (recipe_ingredients join rows intact).

## Notes

- **Reuses the parent engine wholesale** — no kitchen-specific runtime; data + agents + pages + hooks
  on the shared layer. If a mechanism is missing here, it belongs in
  [the project-as-application model](../org/format/project/README.md), not a kitchen fork.
- **Why it's a good AI-assisted app** — meal planning is a recurring, low-reward chore with lots of
  soft constraints (what's in the pantry, who's home, dietary needs, spoilage). That's precisely what
  an assistant is good at and a person resents doing every week; the payoff is a planned week and a
  correct shopping list for near-zero effort.
- **Unit conversion is an agent concern, not a schema one** — the schema stores `quantity` in each
  ingredient's own `unit`; reconciling "2 cups" vs "480 ml" is left to the planner/shopper prompts,
  kept out of the columns.
- **The "one plan per week" and quantity math** live in agent logic + a `weekStart` unique constraint;
  the diff itself is deterministic handler code (`shoppingList`) so the UI and the shopper agree. The
  app stays within per-user pod isolation, so no v1 deviation from the parent plan's authz model.
- **`db.query` `where` is equality-only** in the shipped engine (`Record<string,unknown>` +
  `include`/`orderBy`/`limit`/`offset`; no `LIKE`/ranges). Every filter that isn't an exact match —
  "recipes tagged X", "meals for this day", "positive gaps" — is a query-all-then-filter-in-JS in the
  agent prompt / handler code, not a SQL predicate. The shopping diff is exactly this: read the plan's
  `plan_meals` with `include`, sum required quantities in memory, subtract pantry stock.
- **No external-binding registry exists in v1** — `webSearch`/`webFetch`/`fetch` are **universal
  system globals**, not `api:call` named bindings. So an agent that needs the web (e.g. a future
  recipe importer) declares them under `functions:` (space-function gate) or just calls the universal
  global; `api:call` is reserved for the app's own typed endpoints (e.g. the shopper could `apiCall`
  `shoppingList`). Round 1 seeds a starter recipe box and keeps the `chef` agents **db-only** — the
  planner/shopper/pantry-keeper need no `api:call`; the `recipeSearch`/`webSearch`-driven importer is
  a round-2 (Additional features) concern.
