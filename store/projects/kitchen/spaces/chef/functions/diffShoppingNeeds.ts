/**
 * The shopper's core diff: given the week's total required quantity per ingredient and what the
 * pantry already has, returns only the positive gaps — the same "required minus pantry, keep only
 * what's still short" rule `shopping_list` is built from. An ingredient the pantry already fully
 * covers (or over-covers) is left out entirely rather than written as a zero or negative row.
 *
 * Pure and deterministic: pass in the two id→quantity maps and get back the gap map, with no
 * knowledge of `db` — the shopper (or the `shoppingList` API handler recomputing on the fly) owns
 * turning each entry into an actual `shopping_list` insert or a rendered line.
 *
 * @param required - ingredient id → total quantity the week's `plan_meals` need, already scaled
 *   to each meal's `servings` (see `scaleQuantity`) and summed across every meal that uses it.
 * @param pantry - ingredient id → quantity currently on hand (`ingredients.quantity`).
 * @returns ingredient id → quantity still needed, for every ingredient whose required amount
 *   exceeds pantry stock. Ingredients fully covered by the pantry are omitted, not zeroed.
 */
export function diffShoppingNeeds(
  required: Record<string, number>,
  pantry: Record<string, number>,
): Record<string, number> {
  const gaps: Record<string, number> = {};
  for (const ingredientId of Object.keys(required)) {
    const gap = required[ingredientId] - (pantry[ingredientId] ?? 0);
    if (gap > 0) gaps[ingredientId] = gap;
  }
  return gaps;
}
