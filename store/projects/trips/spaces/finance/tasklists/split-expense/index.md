---
input:
  expenseId: string
---

Split one un-split expense evenly across the trip's travelers: load the expense and its trip's
party, then write one `expense_shares` row per traveler so the shares sum exactly to the expense's
amount.
