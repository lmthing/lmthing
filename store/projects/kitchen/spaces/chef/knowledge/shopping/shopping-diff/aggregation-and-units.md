# Aggregation and units

## Summing one ingredient across multiple meals

The same ingredient often shows up in more than one meal in the same week — olive oil, garlic,
onions are common across many recipes. `required` has to accumulate every meal's scaled
contribution for a given `ingredientId` into one running total (`required[id] = (required[id] ||
0) + scaled`), not overwrite it per meal. This is the whole reason `required` is built as an
id-keyed map rather than a flat list of per-meal lines — by the time the diff runs, every meal
that touches "garlic" has already been folded into a single number for `garlic`'s id, and the
pantry subtraction happens once per ingredient, not once per meal-that-uses-it.

## Unit consistency is guaranteed by the schema, not computed

Because `recipe_ingredients.quantity` and `ingredients.quantity` are both expressed in the pantry
ingredient's own `unit` (there's exactly one `ingredients` row per real-world ingredient, and every
recipe line referencing it inherits that unit implicitly through the foreign key), the aggregation
never has to convert between units itself — a `recipe_ingredients` line for "olive oil" is already
in whatever unit the `ingredients` row for olive oil uses. This is different from, say, a grocery
API that might return quantities in inconsistent units from different sources; here the schema's
one-ingredient-one-unit design means summing quantities by `ingredientId` is always safe.

## Where real unit judgment calls happen — recipe authoring, not the diff

The place unit mismatches can actually arise is earlier, when a recipe is authored or imported
(see the `sourcing` space's recipe import) and a line's quantity is entered in a unit that doesn't
match the pantry ingredient it's linked to (e.g. a recipe written in tablespoons of oil, linked to
an `ingredients` row tracked in `'ml'`). Reconciling that is a judgment call made once, at
authoring/import time, by converting the recipe's stated quantity into the pantry ingredient's unit
before the `recipe_ingredients` row is ever written — not something the shopper's diff can or should
attempt to detect or fix at compute time, since by the time `recompute` runs, `quantity` is assumed
to already be correct in the referenced ingredient's unit. Treat a shopping list that looks wildly
implausible (e.g. "buy 4000ml of garlic") as a signal to go check how that recipe's ingredient line
was authored, not something the diff logic itself needs to guard against.
