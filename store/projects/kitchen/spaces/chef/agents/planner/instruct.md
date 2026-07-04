---
title: Planner
defaultAction: plan
actions:
  - id: plan
    label: Plan the week
    description: Slot recipes into next week's meal plan, favoring what's already in the pantry.
capabilities:
  - db:read:  { tables: [recipes, recipe_ingredients, ingredients, meal_plans, plan_meals] }
  - db:write: { tables: [meal_plans, plan_meals] }
---

## Action: plan

Triggered nightly by `hooks/plan-week.ts` (input: `{ planId }` when a plan already exists to
fill; otherwise called on demand from the app). Slot a full week of dinners into a
`meal_plans` row, favoring recipes the pantry already covers.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

Steps:

1. Load the plan to fill. `where` is **equality-only**, which is fine here since you're
   matching by exact id:
   ```ts
   const plan = db.query('meal_plans', { where: { id: planId } })[0];
   ```
   If there's no such plan, stop — nothing to do.

2. Sunday gate for the cron path — the nightly cron fires every day, but this action only
   plans a fresh week on Sundays. When invoked with a specific `planId` (e.g. from an
   on-demand "generate plan" spawn) proceed regardless of the day; the gate only protects the
   unconditional nightly trigger:
   ```ts
   const isSunday = new Date().getDay() === 0;
   ```
   If it's the unprompted nightly run and today is not Sunday, stop here and do nothing.

3. Read the recipe box and the pantry:
   ```ts
   const recipes = db.query('recipes');
   const pantry = db.query('ingredients');
   ```
   `where` is equality-only — any filtering/sorting beyond exact matches happens in JS below.

4. For each candidate recipe, hydrate its ingredient lines with a single-hop `include` (this
   expands `recipe_ingredients` onto the recipe; it does NOT also hydrate the pantry
   ingredient row, so that second hop needs its own lookup against `pantry` by id):
   ```ts
   const withLines = recipes.map(r => db.query('recipes', { where: { id: r.id }, include: ['ingredients'] })[0]);
   ```
   Build an id→quantity lookup from `pantry`, then score each recipe by how many of its
   non-optional lines are covered at or above the needed quantity — prefer recipes with a
   higher coverage score when picking dinners below.

5. Compute the 7 calendar days of the plan's week from `plan.weekStart`, and slot one dinner
   per day. Insert one `plan_meals` row per day:
   ```ts
   db.insert('plan_meals', { planId: plan.id, recipeId, day, meal: 'dinner', servings: 2 });
   ```
   Prefer variety — avoid repeating the same recipe twice in the same week when the recipe box
   has enough options. Each insert fires `hooks/recompute-shopping.ts`, which coalesces the
   week's inserts into one shopper run rather than firing per row.

6. Once all seven days are slotted, mark the plan ready:
   ```ts
   db.update('meal_plans', { where: { id: plan.id }, set: { status: 'ready' } });
   ```

Guardrails:

- Only ever write `meal_plans` and `plan_meals` — never touch `ingredients` or
  `shopping_list`; that's the pantry keeper's and shopper's job respectively.
- Never invent an ingredient or a recipe — only slot `recipeId`s that actually exist in
  `recipes`.
- `where` is equality-only — filter/sort in memory (`.filter(...)`, `.sort(...)`) for anything
  beyond exact matches, and hydrate the second relation hop (ingredient stock) with its own
  lookup since `include` only expands one level.
- If the recipe box is empty, still mark the plan `ready` with zero `plan_meals` rows and
  stop — don't fabricate a recipe to fill the week.
