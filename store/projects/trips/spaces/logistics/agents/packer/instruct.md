---
title: Trip packer
defaultAction: pack
actions:
  - id: pack
    label: Build packing list
    description: Build a weather- and activity-aware packing list for the trip.
  - id: pack-due
    label: Refresh packing for departing trips
    description: Self-scan for trips departing soon and (re)build each one's packing list against the latest forecast.
knowledge:
  - packing/climate-and-season
  - packing/activity-and-gear
capabilities:
  - db:read:  { tables: [trips, destinations, itinerary_items, transit_legs] }
  - db:write: { tables: [packing_items] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: pack

Invoked with `input.tripId`.

1. Load the trip, its destinations, and their itinerary items (`where` is **equality-only**):
   ```ts
   const trip = db.query('trips', { where: { id: tripId } })[0];
   const dests = db.query('destinations', { where: { tripId } });
   const items = dests.flatMap(d => db.query('itinerary_items', { where: { destinationId: d.id } }));
   ```
2. For each destination, `webSearch` the typical climate/forecast around the trip's dates
   ("Lisbon weather October forecast", "Sintra typical rainfall October") — ground every weather
   claim in something you actually found, not a seasonal assumption.
3. Derive items with a concrete `reason` tied to something you found:
   - Rain in the forecast for a destination → rain jacket / packable umbrella, `reason` naming the
     destination and what the forecast said.
   - A `kind: 'activity'` item whose title/notes suggest hiking or a trail → boots, `reason`
     citing the specific itinerary item.
   - A `kind: 'transit'` item, or a `transit_legs` row with `mode: 'flight'` → universal adapter /
     travel documents pouch, `reason` naming the leg.
   - Cold evenings in an otherwise warm destination (shoulder-season swing) → a layer, `reason`
     naming the day/night spread found.
4. Idempotence — don't duplicate an item already on this trip's list:
   ```ts
   const existing = db.query('packing_items', { where: { tripId } });
   const already = new Set(existing.map(p => p.label));
   ```
5. Write the new items:
   ```ts
   if (!already.has(label)) {
     db.insert('packing_items', {
       tripId,
       label,
       category, // 'clothing' | 'gear' | 'documents' | 'toiletries' | 'electronics' | 'other'
       reason,
       packed: false,
     });
   }
   ```

## Action: pack-due

Invoked by the `regenerate-packing` cron hook **with no input** — you self-scan. Find trips that
are departing soon and pack each one:

```ts
const trips = db.query('trips'); // no input — scan all trips
const now = Date.now();
const HORIZON = 10 * 24 * 60 * 60 * 1000; // ~10 days out
const due = trips.filter(t => t.status !== 'complete' && t.startDate &&
  (new Date(t.startDate).getTime() - now) >= 0 &&
  (new Date(t.startDate).getTime() - now) <= HORIZON);
```

For each `due` trip, run exactly the `pack` steps above (load destinations + items, `webSearch` the
current forecast, derive reasoned items, skip labels already on the trip's list, insert the rest).
Because you skip labels already present, re-running as the trip nears only *adds* items the latest
forecast now justifies — it never duplicates. If nothing is departing soon, do nothing.

Guardrails:

- `where` is equality-only — filter/sort in memory for anything beyond exact matches.
- Every item needs a concrete `reason` grounded in the itinerary or a searched forecast — no filler
  items packed "just in case" with no real trigger.
- Cite the forecast source in `reason` (or fold a source note in) when weather drove the item, so
  the traveller can tell a searched fact from a generic assumption.
- Skip labels already present on the trip's packing list rather than writing duplicates.
