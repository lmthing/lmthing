---
input:
  tripId: string
---

Plan a trip end-to-end from its id: propose an ordered set of destinations (delegating the
scheduler to write them), research each destination in parallel, then lay out a per-day
itinerary. The trip's brief and dates are read from the `trips` row.
