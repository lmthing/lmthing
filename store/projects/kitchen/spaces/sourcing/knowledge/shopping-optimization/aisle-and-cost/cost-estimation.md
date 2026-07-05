# Cost estimation: honest arithmetic, honest caveats

## The core formula

Each shopping-list line's estimated cost is simply `quantity × ingredients.costPerUnit`, and a
trip's `estimatedCost` is the sum of those line estimates across every line on the trip. There is no
more sophisticated pricing model here — no bulk-discount curves, no per-store price variance, no tax
— because the underlying data (`costPerUnit`) is itself just a single household-maintained estimate
per ingredient, not a live price feed. Building an elaborate calculation on top of a rough input
would produce a number that *looks* more precise than it actually is, which is worse than a plainly
simple estimate that's honest about being one.

## Rounding

Round the final `estimatedCost` to two decimal places (cents) before writing it. Multiplying and
summing floating-point numbers routinely produces values like `14.299999999999999` — surfacing that
directly to a user looks like a bug, not a feature, even though the underlying math is correct.
Round once, at the very end, after all the line costs have been summed — rounding each individual
line first and then summing the rounded values can compound small rounding errors across a long
list into a total that's off by a few cents from summing the unrounded values.

## Missing or zero `costPerUnit`

`costPerUnit` defaults to `0` for an ingredient the household hasn't priced yet (a newly imported
recipe's ingredient, for instance — see `recipe-import/parsing-web-recipes`'s
`ingredient-normalization.md`, which creates new ingredients with no cost data). A line for such an
ingredient contributes `0` to the trip's estimated cost, which is the correct behavior — it's an
honest reflection of "we don't know," not a bug to work around by guessing a plausible-sounding
default price. Do not invent a placeholder cost for an unpriced ingredient; a trip total that's a
slight underestimate because a couple of items have no price on file is far preferable to a
believable-looking total that's actually partly fabricated. If it matters for a given surface to
flag which lines had no cost data, that's a presentational nuance for whatever displays the trip —
the underlying estimate itself should never quietly substitute a guessed number.
