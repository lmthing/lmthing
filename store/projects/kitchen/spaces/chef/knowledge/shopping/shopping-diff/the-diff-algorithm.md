# The diff algorithm

## The join graph: plan_meals → recipes → recipe_ingredients → ingredients

A plan's shopping needs are a two-hop join away from `plan_meals`: each meal points at a `recipe`,
and each recipe's `ingredients` relation expands its `recipe_ingredients` lines (which is where the
per-line `quantity` and `optional` flag live). `include: ['ingredients']` on a `recipes` query
performs exactly one of those hops — it does not also hydrate each line's own `ingredient` row, so
a second, separate lookup (or a plain id-keyed pantry map, since the diff only needs `quantity` per
`ingredientId`) covers that last hop. The whole computation for one plan is a loop over that
plan's (typically 7) `plan_meals` rows, one `recipes` query per meal — not a query per ingredient
line, and not an N+1 walk down into `recipe_ingredients` separately.

## Optional lines are excluded entirely

A `recipe_ingredients` line with `optional: true` represents an ingredient the recipe works without
(a garnish, an optional topping) — it should never contribute to `required`, and therefore never
appear in `shopping_list` even if the pantry has none of it. This is a simple `continue`/`filter`
on `line.optional` before accumulating, but it's easy to forget since the line still needs to be
iterated to reach the ones that do count.

## Scaling by servings before accumulating

Each `recipe_ingredients.quantity` is written for the recipe's own `servings` basis, but the
`plan_meals` row it's slotted into carries its own `servings` (scaled to the household size at
plan time — see `meal-planning/dietary-constraints`'s `household-and-servings.md`). Every line's
quantity must be scaled by `mealServings / recipeServings` (exactly what `scaleQuantity` computes)
before it's added into the running `required` total — skipping this step silently under- or
over-states the shopping list any time a meal's servings differ from the recipe's own default, which
is the common case once a household size other than the recipe's default 2 is configured.

## Clear-then-reinsert, not patch-in-place

`recompute` always removes every existing `shopping_list` row for the plan before inserting the
freshly computed gaps, rather than trying to diff the old rows against the new ones and patch
individual quantities. This keeps the recompute trivially idempotent — running it twice in a row
for the same plan (or being re-triggered multiple times by a burst of `plan_meals` inserts) always
converges to the same final `shopping_list` state, with no risk of stale rows for an ingredient
that's no longer needed lingering behind. The small cost (a full delete + re-insert instead of a
targeted patch) is worth the correctness guarantee, especially since `shopping_list` rows are cheap
and few (one plan's week of meals rarely spans more than a few dozen distinct ingredients).
