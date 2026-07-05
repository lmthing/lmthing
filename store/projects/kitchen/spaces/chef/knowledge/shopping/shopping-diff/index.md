---
variable: shoppingDiff
description: The required-minus-pantry diff algorithm behind shopping_list, and how quantities are aggregated across meals.
---

# The shopping diff

The shopper's entire job reduces to one idea: `shopping_list = required − pantry`, keeping only
the positive gaps. Everything else — the `include` join graph, the per-meal servings scaling, the
optional-line exclusion — exists to compute `required` and `pantry` correctly before that single
subtraction happens. Getting the diff itself is straightforward (`diffShoppingNeeds` does exactly
that, deterministically); the real care is in how `required` gets built up.

`the-diff-algorithm.md` covers the full pipeline — `plan_meals` → `recipes` → `recipe_ingredients`
→ `ingredients`, why it's expressed as a small number of `include`d queries rather than a manual
N+1 loop, why optional lines are excluded, and why the diff always clears and re-inserts rather
than trying to patch existing `shopping_list` rows in place. `aggregation-and-units.md` covers the
part that's easy to get subtly wrong: summing a single ingredient's requirement across multiple
meals in the same week, and why unit reconciliation for a mismatched or ambiguous ingredient is a
prompt-level judgment call rather than something a deterministic function can resolve.
