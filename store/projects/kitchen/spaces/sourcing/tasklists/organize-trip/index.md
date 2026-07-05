---
input:
  planId: string
---

Group a plan's remaining shopping list by grocery aisle and estimate its total cost, then record
the result as a `shopping_trips` row. `planId` is used when given; otherwise the most recently
created plan is self-queried, matching the optimizer agent's `organize` action.
