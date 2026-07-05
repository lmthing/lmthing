---
id: slot_day
dependsOn: [load_context, score_recipes]
forEach: score_recipes.days
role: general
functions: [scaleQuantity]
output:
  day: string
  recipeId: string
---

Fans out over each calendar day produced by `score_recipes`, one branch per day, running in
parallel. `item` is one ISO date string (e.g. `"2026-07-06"`) — slot that day's dinner.

If there are no candidates at all (empty recipe box, or every recipe filtered out), resolve
without inserting anything — never fabricate a recipe to fill a day:

```ts
const candidates = score_recipes.candidates;
if (candidates.length === 0) {
  currentTask.resolve({ day: item, recipeId: '' });
} else {
  // ...
}
```

Pick a recipe for this day from the best-covered candidates. Branches run independently and in
parallel (no shared state between days), so variety across the week is derived from the day's own
weekday rather than coordination with sibling branches — see `variety-and-balance`'s
`rotation-and-repeats.md` for why this is an acceptable trade-off and when a repeat is fine (a
small recipe box legitimately can't fill 7 distinct dinners):

```ts
const dayOfWeek = new Date(item).getDay(); // 0-6, stable per date — spreads picks across the top candidates
const pick = candidates[dayOfWeek % candidates.length];
```

```ts
const settings = load_context.settings;
const servings = settings?.householdSize ?? 2;
const recipe = db.query('recipes', { where: { id: pick.recipeId } })[0];

db.insert('plan_meals', {
  planId,
  recipeId: recipe.id,
  day: item,
  meal: 'dinner',
  servings,
});

currentTask.resolve({ day: item, recipeId: recipe.id });
```

`scaleQuantity` is available here if you need to reason about a specific ingredient line's scaled
amount before committing to a pick (e.g. to double-check a borderline coverage score) — the actual
`plan_meals.servings` scaling of the recipe's lines happens later, in the shopper's `recompute`.

Each insert fires `hooks/recompute-shopping.ts`, which coalesces the week's inserts into one
shopper run rather than firing per row — you don't need to trigger it yourself.

Guardrails:

- Only ever insert into `plan_meals` here — never touch `ingredients`, `recipes`, or
  `shopping_list`.
- Never invent a `recipeId` — only slot recipes that exist in `score_recipes.candidates`.
- This task is not `optional` — a day with a real candidate list should always resolve with a
  slotted meal; only an empty candidate list (handled above) skips the insert.
