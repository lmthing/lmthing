---
variable: tripBudgeting
description: How to estimate honest per-item costs and hold a trip to its budget without gutting what makes it worthwhile — for the scheduler's estimatedCost fields and the researcher's price checks.
---

# Estimating and holding a budget

Every `itinerary_items` row carries a rough `estimatedCost` and `currency`, and every `trips` row
carries a `budgetUsd` the traveller expects the plan to respect. The concierge's credibility rests
on these numbers being honest, sourced estimates — not optimistic placeholders that make the plan
look affordable on paper while the traveller actually needs double that once they're there. A
budget that's wrong in the "we underestimated" direction is far worse than one that's roughly right
but a little conservative, because the traveller can't easily course-correct mid-trip.

`cost-estimation.md` covers how to arrive at a defensible per-item estimate; `trimming-to-fit.md`
covers what to do when the rolled-up estimate exceeds the stated budget — how to cut and swap
without turning the trip into a joyless bare-minimum version of itself. The `rollUpBudget` function
sums booked (`bookings.cost`) and estimated (`itinerary_items.estimatedCost`) spend by kind, which is
what the budget page shows the traveller and what should guide any trimming decision.
