# Fuzzed pin strategies

## The pin is a clue, not a correction target

It's tempting to think of the claimed pin as "roughly right, needs correcting" — but portals fuzz
pins by a random amount in a random direction specifically so the exact center can't be reverse
-engineered from repeated queries. This means the fuzzed pin should be treated as ONE clue circle
among several (a moderate-radius circle, weight roughly equal to a single decent textual clue), not
as a privileged starting point that other clues merely refine. `intersectClues` already handles this
correctly when the pin is passed in as a normal clue entry — resist the urge to give it outsized
weight just because it's the only "official" coordinate available.

## No pin at all is common and shouldn't cause a placeholder

Some captures never carry `claimedLat`/`claimedLng` at all (a portal that doesn't expose one, or a
capture that came from a pasted email with no map data at all). In that case, triangulation rests
ENTIRELY on textual clues — if there are none of those either, the honest output is a wide,
low-confidence circle, not a fabricated central-city placeholder that looks more precise than the
evidence supports. A user should be able to tell from the radius and confidence alone that "we really
don't know" rather than mistaking a wide guess for a tight one.

## When the claimed pin and text clues actively disagree

Occasionally a claimed pin and a strong textual clue (e.g. "2 min from Anjos metro" naming a specific
station) point to noticeably different areas. `intersectClues` will produce a WIDE resulting circle in
this case (the spread between disagreeing clues drives the radius up and confidence down) — that's
the correct, honest behavior, not a bug to work around by dropping one of the clues to get a tighter
answer. A wide circle with a `method` that names the disagreement explicitly ("claimed pin sits ~800m
from the named metro clue — guess widened to cover both") is more useful than a falsely confident
narrow one.
