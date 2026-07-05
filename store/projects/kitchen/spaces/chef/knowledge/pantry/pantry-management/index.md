---
variable: pantryManagement
description: How pantry units, low-stock thresholds, and expiry/waste tracking work and should be reasoned about.
---

# Pantry management

The pantry (`ingredients`) is the shared ground truth every chef agent reads from and the pantry
keeper is the only agent that writes to directly — the planner and shopper both treat it as a
read-only snapshot of what's actually on hand, and it's the accuracy of that snapshot that
determines whether a "well-covered" recipe pick or a shopping-list gap is actually correct. Two
things make pantry data trickier than it first looks: units aren't uniform across ingredients, and
`where` on the database is equality-only, so anything beyond an exact match has to happen in JS.

**Units and stock levels.** Every ingredient has its own `unit` (`'g'`, `'ml'`, or `'count'`) and
its own `quantity` in that unit, plus a `lowStockThreshold` below which it should be treated as
effectively unavailable even though the row still exists with a nonzero quantity. `stock-and-units.md`
covers how to reason about unit consistency (never compare or sum quantities across ingredients
with different units) and how the low-stock threshold changes what "in the pantry" means for
scoring and shopping purposes.

**Expiry and waste.** `ingredients.expiresAt` is optional — most shelf-stable staples never carry
one — and its presence is what drives the `suggest-uses` waste-reduction nudge. `expiry-and-waste.md`
covers how "expiring soon" should be computed, why FIFO thinking matters when an ingredient row
represents a single batch versus an ongoing restocked staple, and how to avoid re-surfacing the
same waste warning every night.
