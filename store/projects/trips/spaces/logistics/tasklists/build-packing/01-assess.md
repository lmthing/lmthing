---
id: assess
output:
  needs: array
dependsOn: []
role: plan
---

Read the trip's destinations and itinerary items, `webSearch` the forecast/typical climate for
each destination around the trip's dates, and summarize what the packing list needs to cover —
one entry per concrete driver (a forecast fact, an activity, a transit leg), each with enough
detail for the next task to write a grounded item from it. `tripId` is in scope from the tasklist
input. `webSearch` is available here even though `role: plan` is read-only with respect to `db`.

```ts
const dests = db.query('destinations', { where: { tripId } });
const items = dests.flatMap(d => db.query('itinerary_items', { where: { destinationId: d.id } }));

// webSearch each destination's forecast/typical climate around its arrival/departure dates,
// then assemble one "need" per concrete driver:
const needs = [
  // { label, category, reason, source } for each forecast fact, hiking/activity item, or
  // transit leg that implies something to pack
];

currentTask.resolve({ needs });
```
