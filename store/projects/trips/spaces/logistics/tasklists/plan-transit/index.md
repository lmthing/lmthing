---
input:
  tripId: string
---

Plan the ordered transit legs for a trip's destinations: order the stops, then write one
`transit_legs` row per hop (including the origin leg into the first destination), each with a
rough mode, duration, cost, and booking window. The trip's destinations are read in `orderIndex`
order.
