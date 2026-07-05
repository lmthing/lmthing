---
input: {}
---

Compute nutrition totals for every planned meal that doesn't have them yet, end-to-end: find the
gap between `plan_meals` and `meal_nutrition`, make sure every non-optional ingredient line has a
`nutrition_facts` row (estimating any that are missing), sum and scale each slot's totals into
`meal_nutrition`, then flag any day that lands far outside the household's target as a `nutrition`
suggestion. This tasklist takes **no input** — `hooks/compute-nutrition.ts` fires on any
`plan_meals` insert without saying which rows were added (a coalesced burst can be up to 7 rows),
so every step here self-queries the actual gap rather than trusting a meal id from the caller.
