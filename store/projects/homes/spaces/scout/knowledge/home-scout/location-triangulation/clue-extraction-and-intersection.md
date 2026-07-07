# Clue extraction and intersection

## What counts as a usable clue

A usable textual clue needs to resolve to an actual coordinate: a specific named metro/bus stop
("2 min from Anjos metro"), a named landmark, café, school, or park ("opposite Jardim da Alameda"), or
an actual street name distinct enough to geocode. Vague area names ("central Lisbon," "near
downtown") are too coarse to add real information — including one only inflates the clue count
without tightening the guess, and `intersectClues`'s confidence calculation rewards clue AGREEMENT,
not clue quantity, so padding with weak clues doesn't help and can mislead if it's mistaken for
corroboration.

## Sizing each clue's radius to how precise it actually is

A clue's `radiusM` should reflect how tightly it actually pins down a location: "2 min walk from X"
implies a small radius (a couple hundred meters — an easy walking distance from a named point); "near
X neighborhood" implies a much larger one (the neighborhood's rough extent, potentially 500m–1km+).
Resist defaulting every clue to the same radius regardless of how specific its source phrase was —
that's the single biggest lever for getting `intersectClues`'s confidence output to actually reflect
how well-supported the final guess is.

## Reading `intersectClues`'s confidence honestly

`intersectClues` computes confidence from BOTH how many clues agree AND how tightly they agree — more
clues that cluster near each other push confidence up; a single clue, or several that spread widely,
keep it low (floored at 0.15, capped at 0.95 — it never claims certainty). When writing `method`,
don't just restate the confidence number; explain in plain language what it rests on ("two agreeing
clues — the fuzzed pin and a named metro mention — narrow this to moderate confidence; no independent
third clue to confirm further").
