---
title: Trip scheduler
defaultAction: lay-out
actions:
  - id: propose
    label: Propose destinations
    description: From a trip brief, write an ordered set of destination rows with rough dates.
  - id: lay-out
    label: Lay out the days
    description: From the destinations + research + dates, write ordered itinerary_items day by day.
knowledge:
  - travel/itinerary-pacing
  - travel/budgeting
capabilities:
  - db:read:  { tables: [destinations, research, trips, knowledge_notes] }
  - db:write: { tables: [destinations, itinerary_items] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: propose

Invoked with `input.tripId`, typically by the planner's `plan-trip` tasklist.

1. Load the trip and read its brief (`where` is **equality-only**):
   ```ts
   const trip = db.query('trips', { where: { id: tripId } })[0];
   ```
2. From `trip.brief` and `trip.startDate`/`trip.endDate`, decide on a handful of destinations
   (2–5 for a typical trip) that fit the traveller's time and stated interests. Split the trip's
   date range across them with rough, non-overlapping `arrivalDate`/`departureDate` windows.
3. Write one `destinations` row per stop, in visit order:
   ```ts
   const d = db.insert('destinations', {
     tripId,
     name,
     arrivalDate,
     departureDate,
     orderIndex, // 0, 1, 2, ... in visit order
     notes, // short why-this-stop, what to prioritise
   });
   ```
4. Resolve with the ids so the caller (the planner's `research_each` fan-out) can dive into each:
   ```ts
   currentTask.resolve({ destinationIds: [d1.id, d2.id, ...] });
   ```
   (When invoked directly via `delegate`, return the array however the caller's `defaultAction`
   auto-capture expects — the last resolved/returned value.)

## Action: lay-out

Invoked with `input.tripId` (occasionally `input.destinationId` to redo just one stop).

1. Load the trip's destinations and their research:
   ```ts
   const dests = db.query('destinations', { where: { tripId } });
   const reports = db.query('research', { where: { tripId } });
   ```
   (Filter `reports` in memory per destination — `where` is equality-only, so match by
   `destinationId` per item: `reports.filter(r => r.destinationId === dest.id)`.)
2. For each destination, walk its date window day by day and write itinerary items — a realistic
   mix of `activity`/`meal`/`transit`/`lodging`, informed by the research report's suggestions:
   ```ts
   db.insert('itinerary_items', {
     destinationId: dest.id,
     day, // the calendar date this falls on
     startTime, endTime, // 'HH:MM', omit/leave flexible when not time-critical
     kind, // 'activity' | 'meal' | 'transit' | 'lodging'
     title,
     location,
     notes,
     estimatedCost, // rough, honest — feeds the budget roll-up
     currency, // e.g. 'USD'
     // bookingId intentionally omitted — never invent a reservation
   });
   ```
3. Group sensibly by day — don't overstuff a single day; leave buffer time and an easier
   arrival/departure day at each end of a destination's stay.

Guardrails:

- `where` is equality-only — filter/sort in memory for anything beyond exact matches.
- Realistic pacing: a handful of items per day, not a checklist crammed wall to wall.
- Budget-aware: keep `estimatedCost` grounded in what the research report actually found, not
  optimistic guesses.
- Never invent a booking or confirmation — leave `bookingId` unset; reservations only exist once a
  real booking is made elsewhere in the app.
