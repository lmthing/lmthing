# Choosing a mode and a booking window

## Distance and geography drive mode more than price does

As a rough rule of thumb: under about 300km with reasonable rail infrastructure, a train usually
beats a flight once airport overhead is counted, even when the flight's base fare looks cheaper on
a search page. Between roughly 300-700km, it depends heavily on the specific corridor — a
well-served high-speed rail line (e.g. Madrid–Barcelona, Tokyo–Osaka) still beats flying, while a
similar distance with only slow regional rail or no direct line often flips to flight. Beyond
roughly 700-800km overland, flying usually wins on total door-to-door time unless there's a
specific reason to prefer the ground (scenery, a stopover destination, avoiding an inconvenient
airport). Ferries are mode-of-necessity for island hops and specific coastal routes rather than a
distance-driven choice — check whether one exists on the route before assuming a flight is the
only option. A rental car makes sense when the destinations themselves are spread across a region
with weak public transit (much of the rural US, parts of Ireland/Scotland, wine regions), but adds
its own overhead — pickup/return logistics, parking, an international permit requirement in some
countries — that should show up in `durationMinutes`/`notes` if relevant.

## Booking-window timing by mode

Flights and trains behave very differently as booking windows compress. **Flights**: budget
airlines' cheapest fares typically appear 4-8 weeks out for short-haul, and 2-3 months out for
long-haul; prices tend to climb steeply inside 2-3 weeks of departure, especially for
routes with limited daily frequency. **High-speed/reserved-seat trains** (most of Europe, Japan's
Shinkansen): fares are often released 60-90 days ahead and the cheapest tiers sell out first —
booking a specific popular corridor (Paris–Amsterdam Thalys on a holiday weekend) even a month out
can mean paying 2-3x the earliest-release price. **Unreserved/regional trains, most buses, and
walk-up ferries**: often no meaningful booking-window effect at all — turning up with a ticket
bought same-day is normal and sometimes cheaper than pre-booking. When `webSearch` doesn't turn up
route-specific advice, default `bookByDate` conservatively — 4-6 weeks out for anything flight- or
reserved-rail-based — rather than leaving it too close to departure.

## The transit_legs model

Every field on a `transit_legs` row should trace back to something searched: `mode` from what
actually serves the route, `durationMinutes` from a real schedule (not point-to-point distance,
which ignores airport time, transfers, and terrain), `estimatedCost` from a real fare search,
`bookByDate` from the mode's typical booking-window behavior above, and `currency` matching what
the fare was actually quoted in (don't silently convert to USD — note the original currency and
let the budget roll-up handle conversion context separately). `notes` is where the citation and
the tradeoff live — "≈2h15m, from €45 one-way if booked 6+ weeks out, rises to €90+ inside 2 weeks
(source: SNCF Connect, checked Jul 2026)" is a usable note; "train, ~2h, cheap" is not.
