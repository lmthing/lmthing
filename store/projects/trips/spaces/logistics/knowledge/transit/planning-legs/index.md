---
variable: planningLegs
description: How to choose a transit mode, sequence multi-leg journeys, and decide when a leg needs booking soon — for the navigator's transit_legs rows.
---

# Planning transit legs

A `transit_legs` row is a claim about how the traveller gets from one destination to the next (or
from home into the first destination): a mode, a rough duration, a rough cost, and a date by which
booking it locks in a normal fare. Getting this right matters more than it looks — an itinerary
built on an unrealistic transfer time cascades into missed connections and blown days, and a
missed booking window can double a fare or close it off entirely.

The navigator's job when writing a leg is to ground every field in something actually found via
`webSearch` — a route's real duration, a route's real typical price, a route's real advance-booking
behavior — rather than a plausible-sounding guess from straight-line distance. `choosing-mode.md`
covers how to pick a mode and time a booking window; `sequencing-and-overnights.md` covers ordering
multi-leg journeys and the tradeoffs of red-eye/overnight travel.

A leg is always written `status: 'suggested'` — the navigator proposes options and rough numbers,
it never fabricates a confirmed reservation. The traveller (or a future booking flow elsewhere in
the app) is what turns a suggested leg into a real one. Because of this, a leg's `notes` field
should read like a researched recommendation the traveller can act on — what was found, roughly
when to lock it in, and what tradeoff it involves (cheaper-but-slower vs. faster-but-pricier) —
not a bare number with no context.

Legs interact with the rest of the trip: an `itinerary_items` row of `kind: 'transit'` on the
scheduler's side represents the same hop as a scheduled event with a time slot, while the
`transit_legs` row here is the logistics-side plan (mode/cost/booking window) that informs it. The
two aren't automatically the same row and can drift if either is edited independently — the
navigator's job is the legs, not the day-by-day schedule.
