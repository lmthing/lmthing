# Dimensions and scale

## The sum is a floor, not a ceiling, on real usable area

`sumRoomAreas` only counts rooms whose dimensions or area actually appear in the parseable text — a
description that only mentions 3 of 5 rooms (skipping, say, a hallway and a storage closet) will
produce a total lower than the real usable area even for an honestly-priced listing. This means a
SHORTFALL is only meaningful evidence of overstatement when it's LARGE relative to the stated area
(materially more than what "a couple of unmentioned small rooms" could plausibly explain) — a small
gap is more likely incomplete parsing than a genuine size claim problem, and should be treated as
low-confidence or skipped rather than flagged.

## More rooms parsed means more confidence, not just a bigger number

A floorplan finding's `confidence` should scale with HOW MANY rooms `sumRoomAreas` actually managed to
parse, not just with the size of the discrepancy: a listing where 5+ rooms were successfully
identified and their sum still falls well short of the stated area is strong, well-supported evidence;
a listing where only 1–2 rooms parsed (most of the description had no dimension-bearing text at all)
gives a much weaker basis for the same conclusion, even if the raw shortfall number looks similar.

## Dimension multiplication vs. stated area — know which basis backed each room

`sumRoomAreas` distinguishes rooms whose area came from multiplying two dimensions (`"3.4 x 4.1"`)
from rooms whose area was stated directly (`"18 m²"`) — the `basis` field on each parsed room. A
multiplied dimension is measuring wall-to-wall room size, which typically runs a bit larger than a
"usable"/"livable" area figure a portal might quote (which sometimes nets out fixtures, wall
thickness, or built-in furniture) — worth keeping in mind before treating a small negative gap as
proof of anything: the comparison basis itself isn't perfectly apples-to-apples.
