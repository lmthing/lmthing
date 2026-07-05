# Aisle grouping: a store-walk order, not an alphabetical one

## Why order matters at all

A shopping list's *contents* are already fixed by the time the optimizer sees them — the
list-building work happened earlier, computing the gap between what a week's recipes need and what
the pantry already has. What the optimizer adds is purely presentational, but that presentation has
real value: a household holding a phone in a grocery store benefits enormously from a list that
reads in the same order they'll actually walk the aisles, rather than one they have to mentally
re-sort every time they glance at it.

## The canonical order

Grocery stores are laid out with enough consistency across chains that a single reasonable default
order covers most real trips: **produce → dairy → meat → bakery → pantry → frozen**, with anything
that doesn't fit a known category collected under an **other** bucket at the end. The reasoning
behind this specific sequence mirrors how most stores are actually laid out and how perishables are
best handled: produce and bakery are typically near the entrance and don't need refrigeration
in the cart for long, dairy and meat come next and want to spend less time at room temperature,
pantry/dry goods are shelf-stable and can go in the cart at any point, and frozen goods go dead last
so they have the least time to start thawing before checkout and the trip home.

This order is a default, not a hard law — a real household's local store might genuinely be laid
out differently — but in the absence of per-store layout data, a single consistent default that's
applied identically to every organized trip is far more useful than either an arbitrary order that
changes trip to trip, or a "smarter" per-store heuristic that doesn't actually have the data to back
it up.

## Handling an unrecognized category

Not every `ingredients.category` value will necessarily be one of the known aisle buckets — a
household's pantry might include a category like `"spices"` or `"snacks"` that doesn't map cleanly
onto the canonical six. The right behavior is to append these as their own aisle group(s) after the
known ones, in whatever order they're encountered, rather than either dropping the ingredient
entirely (an omitted item is a real gap in the shopping trip) or forcing it into a mismatched
existing bucket (filing "chocolate bars" under "pantry" is more confusing than giving it an honest
"other" or "snacks" grouping of its own). An ingredient with no category at all should fall into a
generic `'other'` bucket for the same reason — visible and accounted for, never silently lost.
