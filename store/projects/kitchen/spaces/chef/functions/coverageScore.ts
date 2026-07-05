export interface RecipeIngredientLine {
  ingredientId: string;
  quantity: number;
  optional?: boolean;
}

/**
 * Scores how well the pantry already covers a recipe's ingredient lines, as a `0..1` fraction —
 * the planner's tie-breaker for favoring recipes that need little or no shopping over ones that
 * would blow a big hole in the week's shopping list. `1` means every non-optional line is fully
 * stocked at or above the quantity the recipe (scaled to `recipeServings`/`targetServings`) needs;
 * `0` means none of it is on hand.
 *
 * Only non-optional lines count — an `optional` line the shopping diff would skip anyway shouldn't
 * penalize a recipe just because that one garnish isn't in the pantry. Each line contributes
 * fractional credit (`min(1, have / need)`) rather than an all-or-nothing pass/fail, so a recipe
 * that's mostly stocked but short on one ingredient still scores higher than one stocked on
 * nothing at all — useful for ranking candidates, not just filtering them.
 *
 * A recipe with zero non-optional lines (unusual, but not invalid) scores `1` — there is nothing
 * left to shop for, vacuously fully covered.
 *
 * @param lines - the recipe's hydrated `recipe_ingredients` lines (from `include: ['ingredients']`).
 * @param pantry - an ingredient id → quantity-on-hand lookup, built from `db.query('ingredients')`.
 * @param recipeServings - the recipe's own `servings` basis the lines' quantities are written for.
 * @param targetServings - how many servings are actually being planned (defaults to `recipeServings`,
 *   i.e. no scaling, when omitted).
 * @returns a coverage score in `[0, 1]`, higher is better stocked.
 */
export function coverageScore(
  lines: RecipeIngredientLine[],
  pantry: Record<string, number>,
  recipeServings: number,
  targetServings: number = recipeServings,
): number {
  const required = lines.filter((line) => !line.optional);
  if (required.length === 0) return 1;

  const scale = recipeServings > 0 ? targetServings / recipeServings : 1;

  let total = 0;
  for (const line of required) {
    const need = line.quantity * scale;
    const have = pantry[line.ingredientId] ?? 0;
    total += need > 0 ? Math.min(1, have / need) : 1;
  }
  return total / required.length;
}
