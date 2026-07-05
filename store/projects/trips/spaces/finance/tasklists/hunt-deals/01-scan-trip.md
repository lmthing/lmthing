---
id: scan_trip
output:
  found: array
dependsOn: []
role: plan
---

Read the trip's destinations, transit legs, and itinerary items, then `webSearch` for cheaper
alternatives and booking-window savings on the routes/stays/activities you find — a fare window, a
city pass, a discount tactic. `tripId` is in scope from the tasklist input. `webSearch` is available
here even though `role: plan` is read-only with respect to `db`.

```ts
const dests = db.query('destinations', { where: { tripId } });
const legs = db.query('transit_legs', { where: { tripId } });
const items = dests.flatMap(d => db.query('itinerary_items', { where: { destinationId: d.id } }));

// webSearch cheaper-alternative / booking-window angles for the legs and costed items above
// (e.g. "cheapest time to fly to Lisbon October", "Lisboa Card worth it"), then assemble one
// entry per real, cited saving that's actually relevant to this trip's plans — see
// money/deal-hunting/value-vs-price.md before including anything marginal:
const found = [
  // { kind, title, description, estimatedSavings, currency, url } for each grounded saving
];

currentTask.resolve({ found });
```
