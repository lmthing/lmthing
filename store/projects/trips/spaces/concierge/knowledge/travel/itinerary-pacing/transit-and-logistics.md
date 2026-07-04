# Transit and logistics

## Ordering destinations to minimize backtracking

`destinations.orderIndex` should reflect an efficient route, not the order the traveller happened
to mention places in their brief. Given a handful of destinations, sequence them along a sensible
path (roughly geographic proximity/along a route) so the traveller never doubles back through a
place they've already left — a classic mistake is ping-ponging between a coastal town and an inland
city because the brief mentioned them in an inconvenient order. When proposing destinations
(scheduler `propose` action), think about the map, not just the list.

## Transit as its own itinerary item

Every meaningful move between destinations deserves its own `itinerary_items` row with `kind:
'transit'` — a flight, train, or long drive is not incidental background, it's a scheduled event
with a real time cost that eats into what else can be scheduled that day. Include realistic
transfer time (getting to the station/airport, security/boarding buffer, getting from the arrival
station to lodging) in the transit item's time window, not just the "in transit" segment itself.
Treat the day a transit leg happens as constrained the same way an arrival day is — don't schedule
a full slate of activities on both sides of a half-day transfer.

## Realistic transfer times

Don't assume travel times from straight-line distance — a destination's research report or a quick
`webSearch` on "X to Y travel time train/flight" should ground the actual duration, including that
published "2 hour flight" durations don't include airport time (budget 2-3 extra hours total for a
short-haul flight once security/boarding/deplaning/luggage are included; less for a train, which
usually has much shorter effective buffer). When in doubt, err toward a more conservative (longer)
estimate for `startTime`/`endTime` on a transit item — an itinerary that assumes the best case at
every transfer is fragile.

## Lodging as an anchor

Once a destination's rough lodging area is known (even before a real booking exists), it's the
implicit "home base" for that stint — sequence a day's activities to minimize the total walking/
transit distance back to it, and specifically avoid scheduling a late-night activity far from
lodging on the same day as an early departure or early next-day plan. Lodging doesn't need its own
`itinerary_items` row for every night (that would be redundant with the destination's
`arrivalDate`/`departureDate`), but a single `kind: 'lodging'` item is useful to represent a
check-in/check-out with a specific time window when it constrains the day (e.g. an early morning
checkout with an all-day activity after).
