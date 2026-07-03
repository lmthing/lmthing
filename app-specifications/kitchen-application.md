# lmthing.kitchen as a Project-Application — the `kitchen` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for a
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
│   │   └── [id]/PATCH.ts             # updatePantry (set quantity — "used the milk")
│   └── shopping/
│       └── [id]/PATCH.ts             # toggleBought (mark a shopping row bought → adds to pantry)
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
| `pages/pantry.tsx` | `/pantry` | `listPantry`; `updatePantry`/`addIngredient` |
| `pages/plan/[planId].tsx` | `/plan/:planId` | `currentPlan`-shaped for a specific week; `updateMeal` on swap |
| `pages/shopping.tsx` | `/shopping` | `shoppingList`; `toggleBought` |

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
| `shoppingList` | `GET api/plan/:id/shopping` | `{ id }` → `(ShoppingItem & { ingredient })[]` |
| `listRecipes` | `GET api/recipes` | `{ tag? }` → `Recipe[]` |
| `addRecipe` | `POST api/recipes` | `{ title, instructions, ingredients:[{name,quantity,unit}] }` → `Recipe` |
| `getRecipe` | `GET api/recipes/:id` | `{ id }` → `Recipe & { ingredients: (RecipeIngredient & { ingredient })[] }` |
| `updateMeal` | `PATCH api/meals/:id` | `{ id, recipeId?, day?, servings? }` → `PlanMeal` |
| `removeMeal` | `DELETE api/meals/:id` | `{ id }` → `{ ok }` |
| `listPantry` | `GET api/pantry` | `{}` → `Ingredient[]` |
| `addIngredient` | `POST api/pantry` | `{ name, unit, quantity?, category? }` → `Ingredient` |
| `updatePantry` | `PATCH api/pantry/:id` | `{ id, quantity }` → `Ingredient` |
| `toggleBought` | `PATCH api/shopping/:id` | `{ id, bought }` → `{ ok }` |

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
| **planner** | `recipes, recipe_ingredients, ingredients, meal_plans, plan_meals` | `meal_plans, plan_meals` | `recipeSearch`, `webSearch` | pick recipes for the week (respecting pantry + tags); write the plan (a `forEach` over days) |
| **shopper** | `plan_meals, recipes, recipe_ingredients, ingredients` | `shopping_list` | — | diff week-required vs pantry (the join) → write `shopping_list` gaps |
| **pantry-keeper** | `ingredients` | `ingredients` | — | chat: keep pantry stock accurate; add new ingredients |

```yaml
# kitchen/spaces/chef/agents/planner/instruct.md frontmatter
capabilities:
  - db:read:  { tables: [recipes, recipe_ingredients, ingredients, meal_plans, plan_meals] }
  - db:write: { tables: [meal_plans, plan_meals] }        # writes the week; never touches pantry or shopping
  - api:call: { allow: [recipeSearch, webSearch] }        # find new recipes when the box is thin
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
8. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as a worked example.

## Verification (end-to-end, local)

1. Load the `kitchen` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts`
   has `Ingredient`/`Recipe`/`RecipeIngredient`/`MealPlan`/`PlanMeal`/`ShoppingItem` with relation
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
  [project-as-application.md](./project-as-application.md), not a kitchen fork.
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
