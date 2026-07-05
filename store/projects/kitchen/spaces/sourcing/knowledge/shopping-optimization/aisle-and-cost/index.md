---
variable: aisleAndCost
description: Turning a plan's shopping-list gap into an aisle-organized, cost-estimated trip a household can actually walk through the store with.
---

# Organizing a shopping trip

A raw shopping-list diff — a flat list of "buy 500g flour, buy 2 onions, buy 1L milk" — is
technically complete but practically annoying: nobody wants to walk a grocery store bouncing
between aisles because their list happens to be sorted alphabetically or by insertion order. The
optimizer's `organize` action (and the `organize-trip` tasklist that mirrors it) turns that flat
diff into something shaped like the store itself: lines grouped by `ingredients.category` into a
sensible walk order, with an estimated total cost attached so the household knows roughly what the
trip will run before they leave the house.

Two closely related but distinct judgment calls live in this topic. The first is purely spatial —
given a set of ingredient categories, what order does a household actually walk a typical grocery
store in, and what happens with a category that doesn't fit any known aisle. The second is
numerical — how to turn `quantity × costPerUnit` into a trustworthy-looking estimate without
pretending to a precision the underlying data doesn't support (an ingredient's `costPerUnit` is
itself just an estimate, updated occasionally, not a live price feed).

`aisle-grouping.md` covers the store-walk ordering in detail — the canonical aisle sequence and how
to place a category outside it. `cost-estimation.md` covers the arithmetic and its honest caveats —
rounding conventions, and what to do when `costPerUnit` is missing or zero for some of the items on
the list.
