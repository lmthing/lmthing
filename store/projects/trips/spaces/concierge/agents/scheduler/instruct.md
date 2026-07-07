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
  - db:read:  { tables: [destinations, research, trips, knowledge_notes, traveler_preferences] }
  - db:write: { tables: [destinations, itinerary_items, knowledge_notes] }
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

1. Load the trip, its destinations, their research, **and the party's reconciled constraints**.
   This lay-out is the flagship reasoning turn — pace and content must honour who is actually
   travelling and the money that's actually available, not a generic tourist plan:
   ```ts
   const trip = db.query('trips', { where: { id: tripId } })[0];
   const dests = db.query('destinations', { where: { tripId } });
   const reports = db.query('research', { where: { tripId } });
   // The companions/host writes a "Party preferences & constraints" note — read it and obey it.
   const notes = db.query('knowledge_notes', { where: { tripId } });
   const party = notes.find(n => n.topic === 'Party preferences & constraints');
   const prefs = db.query('traveler_preferences'); // filter in memory to this trip's travellers
   ```
   Consume these deliberately:
   - **Hard constraints win.** Any preference the host marked high-weight (allergies, mobility
     limits) is non-negotiable — never schedule a meal or activity that violates it.
   - **Pace for the slowest traveller.** If anyone needs a gentle pace or dislikes early starts,
     the whole day bends to that; don't cram.
   - **Trim to budget.** Roll up the `estimatedCost` you're about to write per day and keep the
     total within `trip.budgetUsd`; if it won't fit, cut the lowest-value items (per the research)
     rather than shaving everything thin.
   (Filter `reports`/`prefs` in memory per destination/traveller — `where` is equality-only.)
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
4. **Write a short "Why this plan" rationale** as a `knowledge_note` so the choices are
   inspectable — which constraints drove the pace, what you cut to fit the budget, and the rough
   per-day cost roll-up:
   ```ts
   db.insert('knowledge_notes', {
     tripId,
     topic: 'Why this plan',
     body, // 3–6 sentences: constraints honoured, budget fit, trade-offs made
     sourceKind: 'research', // required
   });
   ```
   (Idempotence: if a "Why this plan" note already exists for this trip, update it rather than
   inserting a duplicate.)

Guardrails:

- `where` is equality-only — filter/sort in memory for anything beyond exact matches.
- Realistic pacing: a handful of items per day, not a checklist crammed wall to wall.
- Budget-aware: keep `estimatedCost` grounded in what the research report actually found, not
  optimistic guesses.
- Never invent a booking or confirmation — leave `bookingId` unset; reservations only exist once a
  real booking is made elsewhere in the app.
