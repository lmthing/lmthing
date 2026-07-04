---
variable: climateAndSeason
description: How to translate a searched forecast/climate outlook into concrete packing items, and the seasonal traps that make "warm" or "rainy" destinations misleading.
---

# Climate and season

The packer's job starts with a real forecast or climate outlook for each destination around the
trip's actual dates — never a generic "it's summer so pack shorts" assumption. A `webSearch` for
the destination and month grounds the list in what the weather is actually likely to do, and every
climate-driven `packing_items` row should trace back to that search in its `reason`.

`reading-a-forecast.md` covers how to turn temperature ranges, precipitation likelihood, and
humidity into specific clothing and gear decisions — the layering logic that handles a day with a
15°C swing, when a forecast's "30% chance of rain" is worth packing for versus not.
`shoulder-season-traps.md` covers the recurring seasonal surprises: a destination that's warm by
day and cold at night, a "dry season" that isn't dry at the traveller's actual dates, and the gap
between a home-climate intuition and what a specific destination and month actually do.

Every item this knowledge produces should be traceable to a specific forecast fact, not a vague
seasonal vibe — "expect lows near 8°C in the evenings in October per [source]" justifies a warm
layer; "it might get cold" does not.
