---
input:
  planId: string
---

Diff a plan's total ingredient needs against the pantry and (re)write its `shopping_list`.
Triggered by `hooks/recompute-shopping.ts` whenever `plan_meals` rows are inserted, coalesced
across a burst of inserts into one run. See `shopping/shopping-diff` for the full reasoning behind
the required-minus-pantry diff and why it's a join, not a loop.
