---
variable: itineraryPacing
description: How to build a realistic day — how many things to schedule, how to sequence destinations and transit, and how to avoid the classic overstuffed-itinerary failure mode.
---

# Building a realistic day

The single most common failure in a hand-built or naively-generated itinerary is overstuffing —
scheduling every "worth doing" item the research turned up back-to-back with no slack, as if travel
between and inside destinations, meals, fatigue, and the occasional thing running long simply don't
exist. An itinerary that looks impressive on paper (five attractions, three meals, a sunset viewpoint,
all in one day) is often miserable to actually live through, and the first delay cascades into
missing everything after it.

The scheduler's job when writing `itinerary_items` is to convert a destination's research into a
day-by-day plan that a real, tired, hungry human could actually execute — which means treating pace,
meal cadence, and buffer time as first-class constraints, not afterthoughts. `daily-rhythm.md` covers
how to shape one day; `transit-and-logistics.md` covers how to sequence and connect days across
multiple destinations (the `orderIndex` on `destinations`, and the transit legs between them).

A good itinerary should feel like it has room to breathe — an unhurried traveller re-reading it
should be able to picture actually doing each thing, not skimming a checklist.
