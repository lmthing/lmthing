# Cost estimation

## Estimate by tier, then ground with a real search

Rather than inventing a number, anchor every `estimatedCost` to (a) a stated tier signal from the
`brief` (budget/mid-range/high-end/"treat ourselves") and (b) an actual `webSearch` for real current
prices at that destination — "average restaurant meal price Lisbon 2026", "museum admission
Barcelona", "one-way metro fare Tokyo" — rather than a flat guess. Prices vary enormously by
destination even within the same tier label (a "mid-range dinner" is a very different number in
Tokyo vs. Lisbon vs. Zurich), so a number pulled from general knowledge without a destination-
specific check is exactly the kind of unsourced claim the researcher's guardrails exist to prevent.

## By kind

- **Meals** — estimate per person, and be explicit in `notes` if it's per-person vs. for the whole
  party (the schema doesn't track party size, so keep `estimatedCost` consistently per-person or
  consistently per-item and say which in `notes`). A "meal" item spans a huge range: a market food
  stall vs. a sit-down mid-range restaurant vs. a tasting-menu splurge — pick the tier that matches
  the trip's stated budget and destination cost level.
- **Transit** — look up the actual fare type (metro/bus single fare vs. day pass vs. intercity
  train/flight); day passes are often better value once more than 2-3 rides are planned in a day,
  worth noting even if the exact choice is left to the traveller.
- **Lodging** — since `bookings` (not `itinerary_items`) holds real reservations, a lodging
  `itinerary_items` row (when used at all, per `transit-and-logistics.md`) doesn't need its own
  cost estimate unless it represents an added, unbooked expense (e.g. a resort fee) — otherwise
  leave `estimatedCost` at its default.
- **Activities** — separate free (a public viewpoint, a walk through a neighborhood) from paid
  (timed-entry tickets, guided tours) explicitly; don't default every activity to some nonzero
  placeholder cost when the research clearly found it's free.

## Currency

Always set `currency` to the destination's actual local currency's ISO code (not automatically
`USD`) when costs are naturally denominated there — a Tokyo meal estimate in JPY converted mentally
by the traveller is more useful and less lossy than a rough USD conversion baked in by the
scheduler. Only use `USD` directly when the trip's `budgetUsd` context makes a same-currency
comparison clearly more useful, or when research sources themselves quoted USD.

## Where costs hide

The estimates most itineraries get wrong are the ones that don't look like "the activity" itself:
resort/city tourist taxes charged at checkout, mandatory guide/entry fees bundled separately from a
"free" museum's special exhibitions, credit-card foreign-transaction fees, and the cost of getting
to/from an out-of-town attraction (a paid shuttle or long taxi that can rival the attraction's own
admission price). When research surfaces one of these, put it in `notes` even where it doesn't
cleanly map to its own `itinerary_items` row.
