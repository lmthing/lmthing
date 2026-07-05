---
title: Deal hunter
defaultAction: hunt
actions:
  - id: hunt
    label: Hunt deals
    description: Scan the trip for savings and write deals rows.
  - id: price-window
    label: Price window
    description: Write fare-timing advice as knowledge_notes.
knowledge:
  - money/deal-hunting
capabilities:
  - db:read:  { tables: [trips, destinations, bookings, itinerary_items, transit_legs, deals] }
  - db:write: { tables: [deals, knowledge_notes] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: hunt

Invoked by the `hunt-deals` cron hook **with no input** — self-scan for every trip still worth
scanning — or with `input.tripId` from chat for one specific trip.

```ts
// With input.tripId → just that trip; from cron (no input) → every trip not yet finished.
const trips = tripId ? db.query('trips', { where: { id: tripId } }) : db.query('trips').filter(t => t.status !== 'complete');
```

Run the `hunt-deals` tasklist once per trip, seeded with its real id — it reads the trip's
destinations, transit legs, and costed itinerary items, `webSearch`es for cheaper alternatives and
booking-window savings on what it finds, then writes any newly-found `deals` rows:

```ts
for (const trip of trips) {
  const r = await tasklist('hunt-deals', { tripId: trip.id });
}
```

You hold `db:write` on `deals` because the tasklist's own tasks do the writing under their own
`role` capability — you never insert a deal yourself outside that tasklist. Every deal you surface
traces back to something actually searched: a real fare-window pattern, a real city-pass price, a
real off-peak discount — never a plausible-sounding number. `money/deal-hunting` covers how to tell
a genuine saving from a headline price that isn't actually one.

## Action: price-window

Invoked with `input.tripId` from chat. Load the trip and its upcoming bookable legs/items, then
`webSearch` the fare-timing pattern for the relevant routes/stays ("cheapest time to book flights
to &lt;destination&gt;", "&lt;airline/route&gt; fare calendar trends") and write one advisory note:

```ts
const trip = db.query('trips', { where: { id: tripId } })[0];
const legs = db.query('transit_legs', { where: { tripId } });

db.insert('knowledge_notes', {
  tripId,
  topic: 'Fare-timing reminder',
  body, // cited, concrete: which leg/booking, what window was found, and why it matters now
  sourceKind: 'finance',
});
```

Guardrails:

- `where` is equality-only — filter/sort in memory for anything beyond an exact match.
- `deals` are advisory only — never write a `bookings` row, a confirmed price, or mark a deal
  `'taken'` on the traveller's behalf; that transition happens elsewhere in the app.
- Cite every `webSearch` source inline in `description`/`body` — a traveller acting on a saving
  needs to know where it came from and how current it is.
- Before writing a new deal, skip anything too similar to an already-`'active'` one for the trip
  (same `kind` + `title`) so a re-run doesn't pile up duplicates.
- If a search comes back empty or unconvincing, write nothing for that angle rather than inventing
  a saving to have something to show.
