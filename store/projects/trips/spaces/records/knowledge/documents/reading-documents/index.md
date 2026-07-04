---
variable: readingDocuments
description: How to read an uploaded trip document well — recognizing what kind of thing it actually is, pulling the fields that matter for each kind, and handling the messy pasted-text reality of real confirmations and itineraries.
---

# Reading uploaded documents well

The records analyst's raw material is whatever a traveller happened to paste or forward —
an airline confirmation email, a hotel booking PDF's copied text, a multi-leg itinerary a travel
agent sent over, a photo of a passport stamp described in words, a screenshot of a place someone
recommended. None of it arrives in a clean, structured format. The analyst's job is to read that
messy text carefully enough to pull out the handful of facts that actually matter — a confirmation
code, a date, a cost, a validity window — without inventing anything the text doesn't actually
state.

Two things matter above all else:

1. **The document's `kind` is a hint, not a fact.** The client guesses `kind` from context (a
   filename, an upload flow) before the analyst ever reads `content`. A guess of `'other'` for a
   forwarded flight confirmation, or `'itinerary'` for what's actually a single hotel booking, is
   common and expected — the analyst's first job in every pass is to read the actual text and
   confirm or correct the kind before extracting anything, exactly as `01-classify.md` does.

2. **Extraction is reading, not reconstruction.** If a booking confirmation states a confirmation
   code and two dates, extract exactly those. If a itinerary is missing an end time, leave the field
   empty rather than estimating one that "seems reasonable." The scheduler and the traveller both
   need to trust that anything the analyst wrote down actually came from the source, not from a
   plausible-sounding fill-in.

This overview is expanded in two aspect files: `booking-confirmations.md` covers the structure of
airline/hotel/car confirmations specifically — the fields to pull and the date/timezone traps that
most often produce a wrong `startAt`/`endAt` — and `itineraries-and-tickets.md` covers the harder
case of a forwarded multi-segment itinerary or e-ticket that implies several destinations and legs
at once.
