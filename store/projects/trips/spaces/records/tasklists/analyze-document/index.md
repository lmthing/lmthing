---
input:
  documentId: string
---

Read an uploaded document and extract it into the trip's structured data, by kind: confirm/correct
the guessed kind, write the domain rows the kind implies (bookings, itinerary items, destinations,
or a knowledge note) with provenance, then optionally kick off research on any new destination.
