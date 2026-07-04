# Itineraries and tickets

## Why these are the hardest documents to read

A single booking confirmation describes one reservation. A forwarded itinerary — from a travel
agent, an airline's "trip summary," or a traveller pasting together several confirmations into one
message — can imply several `destinations` and a dozen `itinerary_items` at once, spread across
multiple cities, multiple transit legs, and multiple providers, all in one blob of `content`. The
temptation is to read the whole thing once and extract everything in a single confident pass; the
safer approach is to segment first, then extract each segment on its own terms, because the fields
that anchor one segment (a hotel's check-in date) are easy to accidentally apply to an adjacent one
(a flight's departure date) when reading linearly through dense text.

## Segmenting a multi-leg itinerary

Look for the natural break points a travel document usually already provides: day headers ("Day 3
— Lisbon to Porto"), blank-line-separated blocks per reservation, or repeated boilerplate ("Flight
details", "Hotel details") that marks a new segment. Each segment typically maps to one of:

- **A transit leg** (flight, train, bus, ferry) → an `itinerary_items` row with `kind: 'transit'`,
  `day` set to the departure date, and `title` naming the route (e.g. "Lisbon → Porto, CP train").
  If the leg moves the traveller between two places that don't yet exist as `destinations` rows,
  the arrival side of the leg is usually the new destination worth creating (the departure side is
  typically already known — the previous stop).
- **A lodging block** (hotel, apartment, hostel spanning several nights) → an `itinerary_items` row
  with `kind: 'lodging'`, `day` set per-night if the schema calls for one row per stay start (a
  single row spanning the stay is also acceptable — don't create N duplicate rows for an N-night
  stay unless the itinerary's own structure already breaks it out that way).
- **A named activity or excursion** (a tour, a museum entry, a day trip) explicitly scheduled in
  the itinerary (not just mentioned as a suggestion) → an `itinerary_items` row with
  `kind: 'activity'`.

## Creating new destinations from an itinerary

When a segment names a place the trip doesn't have a `destinations` row for yet, create one with
`arrivalDate`/`departureDate` read from the itinerary's own dates for that place (the date the
traveller's transit leg arrives there, and the date the next leg departs from it, or the stated
checkout date if it's the trip's final stop). Set `orderIndex` to continue the existing sequence
(one past the current highest `orderIndex` for the trip) so the new stop sorts correctly alongside
destinations from other sources (the planner's direct proposals, other documents). A destination
created this way should trigger a research follow-up exactly like a planner-proposed one — the
traveller finding out about a stop from a forwarded itinerary rather than proposing it themselves
doesn't make it less deserving of a grounded research report.

## When the itinerary is incomplete or a re-upload

A forwarded itinerary often only covers part of a trip (a travel agent's booking for the flights and
hotels, with activities added separately by the traveller later) — that's expected; extract what's
actually there and don't invent the missing pieces. If the same itinerary is uploaded twice (a
traveller re-pastes an email, or forwards an updated version), rely on the confirmation codes and
dates already present in existing `bookings`/`itinerary_items` rows to avoid inserting exact
duplicates — a genuinely updated itinerary (changed flight time, added a night) should still produce
a new or corrected row; an identical re-paste should not double every row in the trip.
