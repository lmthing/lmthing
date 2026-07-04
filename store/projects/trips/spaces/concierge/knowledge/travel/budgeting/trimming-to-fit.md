# Trimming to fit

## Roll up before deciding what to cut

Before trimming anything, use `rollUpBudget` against the trip's current `bookings` +
`itinerary_items` to see where the money is actually going, grouped by kind — trimming should
target the kind that's actually over, not an even haircut across everything. A trip that's over
budget almost entirely because of `lodging`/`transit` bookings won't be fixed by cutting a couple of
inexpensive `activity` items; it needs a different structural choice (fewer destinations, a cheaper
transit routing) instead.

## Free vs. paid alternatives, without downgrading the experience

The best trims swap a paid item for a free or cheaper one that the research report already flagged
as comparably worthwhile — not simply deleting the most expensive item on the list. A viewpoint
with a paid rooftop-bar entry often has a free public equivalent nearby with a similar view (city
parks, public terraces); a paid guided walking tour of a neighborhood can sometimes be replaced by a
self-guided version using the same research that would have informed the tour. Only make this swap
when the research genuinely supports the alternative being comparable — don't invent a "just as
good, free" alternative that wasn't actually found.

## Shortening stays vs. cutting destinations entirely

When the budget gap is structural (too many destinations, too much transit between them) prefer
shortening a lower-priority destination's stay by a day over cutting it to zero — a destination that
was worth including at all is rarely worth including for zero days, and cutting it outright often
means a wasted transit leg already booked/planned around it. Reserve outright cutting a destination
for cases where it was clearly the traveller's lowest-priority add relative to the stated brief.

## Shoulder season

If the trip's dates are flexible and the budget gap is significant, shoulder-season timing (just
before/after a destination's peak season) is often the single highest-leverage lever — meaningfully
lower lodging/flight costs with comparable weather and far fewer crowds, at the cost of a few
seasonal activities being unavailable. This is a bigger, trip-level decision (affects `startDate`/
`endDate`) rather than a per-item trim, so surface it as a suggestion to the traveller/planner rather
than silently shifting dates yourself.

## Don't gut the trip's stated purpose

If the brief said "we really want to eat well here," the meal budget is the last place to trim, even
if it's numerically the easiest lever — cutting there fixes the number while defeating the point of
the trip. Trim in the direction that preserves whatever the traveller said mattered most to them, and
say plainly in `notes` when a trim is a real trade-off (e.g. "dropped the day-trip to keep the food
budget intact") rather than presenting it as a free lunch.
