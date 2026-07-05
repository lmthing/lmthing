# Ingredient normalization: from free text to a pantry row

## Splitting a line into quantity, unit, and name

A raw ingredient line like `"2 cups all-purpose flour"` needs to become
`{ quantity: 2, unit: 'cup', name: 'all-purpose flour' }` before it's usable anywhere else in the
schema. The general shape most lines follow is `<quantity> <unit>? <name>`, but every part of that
is optional or irregular in practice:

- **Quantity** can be a whole number (`2`), a decimal (`1.5`), a simple fraction (`1/2`), or a mixed
  number written as two space-separated tokens (`1 1/2`). All three forms need summing into a single
  numeric quantity — `1 1/2` is `1 + 0.5 = 1.5`, not two separate numbers.
- **Unit** is only a real unit if it's one of a known, closed set (`g`, `kg`, `ml`, `l`, `cup(s)`,
  `tbsp`, `tsp`, `oz`, `lb(s)`, `count`, `clove(s)`, `pinch`, …). A word that looks like it could be a
  unit position but isn't in that set (e.g. "large" in "2 large eggs") is actually part of the name,
  not a unit — treat it as `unit: 'count'`/`'unit'` and fold the descriptor into the ingredient name
  rather than discarding it.
- **Quantity-less lines** — "salt to taste", "pepper", "olive oil for drizzling" — are still real
  ingredients the recipe calls for. Recording them with a neutral placeholder (`quantity: 1,
  unit: 'unit'`) and the full remaining text as the name is far better than dropping them, since a
  recipe missing "salt" from its ingredient list looks subtly, confusingly wrong to a household
  reading it later.

## Matching against the existing pantry

Once a line is split into a candidate name, the next question is whether it's actually a *new*
ingredient or a different spelling of one the household already tracks. Blindly inserting a fresh
`ingredients` row for every parsed line means the pantry fills up with near-duplicates —
`"tomato"`, `"tomatoes"`, and `"Tomato"` as three separate rows — which breaks the whole point of a
shared pantry: the planner's shopping-list diff, the optimizer's aisle grouping, and the low-stock
alerts all key off `ingredients.id`, so three rows for one real-world ingredient means stock tracking
silently fragments across them.

The find-or-create discipline is: normalize the candidate name (case-fold, trim, strip a trailing
plural `s` when a singular match exists) and check it against the existing `ingredients` table by
name before inserting. A confident match — same normalized name, or a name that's a clear substring/
plural variant — should reuse the existing row's `id` rather than creating a new one. Only insert a
genuinely new ingredient when no reasonable match exists, seeding it with `quantity: 0` (since
importing a recipe doesn't mean the household actually owns that ingredient yet — it just means a
recipe now references it) and whatever unit the recipe line implied.

## Unit inference for a newly created ingredient

When an ingredient is genuinely new, the unit it's created with should be the one implied by the
recipe line that introduced it (e.g. a first sighting of "200g pasta" creates the ingredient with
`unit: 'g'`). This isn't always the unit the household will end up tracking pantry stock in long
term — a user might prefer to track pasta by the box rather than by the gram — but it's a reasonable
default that at least keeps the newly created row's unit consistent with the quantity captured
alongside it, rather than defaulting every new ingredient to the same arbitrary unit regardless of
what was actually parsed.
