# Stock and units

## Never mix units across ingredients

`ingredients.unit` is per-row — one ingredient might be tracked in `'g'`, another in `'ml'`,
another as a whole-item `'count'` (eggs, onions, cans). A quantity is only ever meaningful relative
to its own ingredient's unit; `250` means something completely different for a `'g'` flour row
than for a `'count'` egg row. Every calculation that touches quantities — pantry coverage scoring,
the shopping diff, a pantry-keeper update — must key strictly by `ingredientId`, never attempt to
sum or compare raw quantities across different ingredients, and always display a quantity together
with its own `unit` rather than a bare number.

## `where` is equality-only — filter thresholds in JS

The database's `where` clause only supports exact-match equality, so a "quantity below threshold"
or "quantity above zero" check can't be expressed as a query filter — it has to be a `.filter()`
over the full result set in memory: `db.query('ingredients').filter(i => i.quantity <=
i.lowStockThreshold)`. This is the same pattern used throughout the chef space (the planner's
allergy/diet checks, the shopper's optional-line skip) — treat `db.query` as "get the rows," and
treat every actual condition beyond an exact id/name/type match as ordinary JS logic afterward.

## `lowStockThreshold` means "treat as unavailable," not "delete"

A `quantity` at or below `lowStockThreshold` should be treated by the planner as insufficient stock
for coverage-scoring purposes — a recipe that needs 200g of an ingredient sitting at 190g against a
50g threshold is realistically "almost out," even though the raw quantity is technically nonzero
and would pass a naive `have >= need` check if the recipe's need happens to be below what's left.
In practice this shows up as `lowStock` (the `GET api/pantry/low` endpoint) surfacing those rows to
the user as a restock hint — the threshold is advisory information for a human decision, never a
reason for an agent to zero out or remove the ingredient row itself. Only the pantry keeper changes
`quantity`, and only in direct response to what the user actually says they used or bought.
