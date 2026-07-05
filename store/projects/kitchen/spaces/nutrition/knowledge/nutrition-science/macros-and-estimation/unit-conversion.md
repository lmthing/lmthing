# Unit conversion and why estimates are coarse

`estimateNutrition`'s food-family profiles are all expressed **per 100 grams or 100 milliliters**,
because that's the standard basis nutrition figures are normally quoted in. But `nutrition_facts`
needs a per-*unit* figure — matching whatever unit that specific ingredient is stocked and measured
in (`ingredients.unit`: `'g'`, `'ml'`, or `'count'`) — because that's what `recipe_ingredients`
quantities are expressed in.

## Straight scaling for grams and milliliters

For `unit === 'g'` or `unit === 'ml'`, the conversion is a plain divide-by-100: a profile of 200
kcal per 100g becomes 2 kcal per 1g. This is the most reliable leg of the conversion — it's simple
arithmetic on the food-family figure, with no additional guesswork layered on top. All the error at
this stage comes from the profile choice itself (see `macro-profiles.md`), not from the conversion.

## Typical-piece weight for `count`

For `unit === 'count'` — a whole item like "1 onion" or "2 eggs" — there's no natural weight to
divide by, so `estimateNutrition` uses a rough **typical-piece weight** for that ingredient's food
family: about 150g for a "count" protein item (roughly one chicken breast or a couple of eggs), 120g
for a countable vegetable, 150g for a piece of fruit, 30g for a countable dairy item (a slice of
cheese), 5g for a countable oil/fat item (a pat of butter, a teaspoon), and 50g for a countable
grain item (a slice of bread). These are averages across a category that in reality varies a lot —
a garlic clove and a whole cabbage are both notionally "vegetable, count," and one weighs a few
grams while the other weighs over a kilogram. The typical-piece weight is a reasonable default for
common recipe ingredients, but it's the least precise part of the whole estimation chain, and it's
also why `basisNote` explicitly states the assumed piece weight for a `count` ingredient rather than
just saying "estimated."

## Per-serving vs. per-recipe, and where scaling compounds

A `recipe_ingredients.quantity` is set relative to the *recipe's* own `servings` column — "2 onions"
for a recipe that serves 4. When the nutritionist computes a `plan_meals` slot's actual nutrition,
it scales the recipe's total by `slot.servings / recipe.servings`, because the household might cook
that recipe for a different number of people than the recipe's default. Each of these three steps —
food-family classification, per-unit conversion, and serving scaling — is individually reasonable,
but their errors compound: a recipe whose ingredients skew toward one extreme of their family's real
range, scaled to a household size that differs from the recipe's default, can end up meaningfully
off from the ingredients' true nutrition. This is expected and acceptable for a household planning
tool, but it means a computed total should always be presented as an estimate ("roughly 650 kcal"),
never as a precise figure ("exactly 650 kcal"). Rounding is deliberately done once, at the very end
(`sumMacros`), rather than after every intermediate step, so at least the arithmetic itself doesn't
add its own additional drift on top of the estimate.
