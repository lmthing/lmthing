---
variable: floorplanMeasurement
description: How the analyst cross-checks a listing's stated areaSqm against room dimensions parsed from its own text, via sumRoomAreas — for the floorplan-kind analysis.
---

# Measuring the floor plan against itself

Overstated size is one of the most concrete, checkable claims a listing makes: `sumRoomAreas` parses
per-room dimensions (`"Bedroom 3.4 x 4.1"`, `"Sala 18 m²"`) directly out of the description text and
sums them, giving an independent, text-derived total to compare against the listing's own stated
`areaSqm`. When the two disagree materially, that's not a guess about square footage — it's the
listing's own numbers not adding up, which is meaningfully stronger evidence than a subjective
impression from photos ever could be.

`dimensions-and-scale.md` covers how to read parsed room dimensions honestly (including when the sum
UNDERSTATES its own confidence) and `layout-red-flags.md` covers what the room list itself — not
just the total — can reveal about a floor plan's usability, independent of whether the total area
checks out.
