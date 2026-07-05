/**
 * Scales a single `recipe_ingredients` line's quantity from the recipe's own `servings` basis to
 * however many servings are actually being cooked — the same ratio the planner applies when
 * slotting `plan_meals.servings` to the household size, and the shopper re-applies when summing a
 * plan's total ingredient needs. A recipe written for 4 that's being cooked for 2 needs half of
 * every line; one being doubled for a household of 8 needs twice as much.
 *
 * Deterministic and side-effect free: same three numbers in, same number out, so it can be
 * called freely from either the planner (sizing a candidate before it commits to a slot) or the
 * shopper (accumulating a week's totals) without drifting between the two call sites.
 *
 * @param quantity - the line's quantity as written in `recipe_ingredients`, for the recipe's own `servings`.
 * @param recipeServings - the recipe's own `servings` column (the basis the `quantity` is written for).
 * @param targetServings - how many servings are actually being cooked (e.g. `plan_meals.servings`).
 * @returns the scaled quantity, in the same unit as `quantity`. Returns `quantity` unscaled if
 *   `recipeServings` is missing or non-positive (a malformed recipe should never divide by zero).
 */
export function scaleQuantity(quantity: number, recipeServings: number, targetServings: number): number {
  if (!recipeServings || recipeServings <= 0) return quantity;
  return (quantity * targetServings) / recipeServings;
}
