# Layout red flags

## The room list itself is evidence, independent of the total

Beyond the total-area cross-check, the actual set of rooms `sumRoomAreas` finds (and their relative
sizes) can reveal layout issues worth a mention even when the size claim checks out fine: a listing
described as having a "spacious living/dining area" whose only living-space dimension parses to a
genuinely small figure, or bedrooms whose parsed dimensions are all suspiciously close to a legal
minimum (worth a soft note about whether they'd comfortably fit a real bed and furniture, not just
meet a technical room-count).

## Room-count mismatches against the stated fields

Compare the NUMBER of rooms `sumRoomAreas` actually parsed against the listing's stated `rooms` and
`bedrooms` fields — a big mismatch (the description names dimensions for only 2 spaces while the
listing claims a T4/4-bedroom unit) is itself worth flagging as a `mismatch`-kind finding, separate
from the size question: it suggests either an incomplete description or that some claimed rooms are
very small, undescribed spaces.

## A missing floor plan is itself information

Not every listing includes enough dimensioned text to run this check meaningfully at all — when
`sumRoomAreas` returns few or no parsed rooms, that's not a "no finding," it's worth noting as its own
low-confidence observation ("no room dimensions given in the description — size claim couldn't be
independently checked"), since a size claim that CAN'T be checked is a different situation for a user
than one that WAS checked and passed.
