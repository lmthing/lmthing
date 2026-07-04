---
id: extract
output:
  ok: boolean
dependsOn: [classify]
role: general
functions:
  - parseTripDates
  - extractAmount
---

Write the domain rows implied by the `kind` resolved by `classify`, with a `document_extractions`
row per derived row, following the `analyst`'s `analyze` action and the `extraction/provenance`
knowledge. `documentId` is in scope from the tasklist input; `classify.kind` is the resolved kind.

```ts
const doc = db.query('documents', { where: { id: documentId } })[0];
db.update('documents', { where: { id: doc.id }, set: { status: 'analyzing' } });
const kind = classify.kind;
let extractedSomething = false;
let newDestinationId: string | undefined;
```

`'booking_pdf'` — parse dates and cost deterministically with `parseTripDates`/`extractAmount`
rather than re-reading the whole blob by eye, then insert the reservation with provenance:

```ts
if (kind === 'booking_pdf') {
  const dates = parseTripDates(doc.content ?? '');
  const amount = extractAmount(doc.content ?? '');
  const booking = db.insert('bookings', {
    tripId: doc.tripId,
    kind: '...',            // 'flight' | 'hotel' | 'car' | 'activity' — read from the text, don't guess
    provider: '...',        // read from the text
    confirmation: '...',    // read from the text; leave empty rather than invent one
    cost: amount?.amount ?? 0,
    startAt: dates.start,
    endAt: dates.end,
  });
  db.insert('document_extractions', { documentId: doc.id, table: 'bookings', rowId: booking.id, confidence: 0.9 });
  extractedSomething = true;
}
```

`'ticket_image'`/`'itinerary'` — same deterministic date parsing, applied to one or more new
destinations and the legs/segments they imply:

```ts
if (kind === 'ticket_image' || kind === 'itinerary') {
  const dates = parseTripDates(doc.content ?? '');
  const dest = db.insert('destinations', {
    tripId: doc.tripId,
    name: '...',           // the place named in the text
    arrivalDate: dates.start,
    departureDate: dates.end,
  });
  db.insert('document_extractions', { documentId: doc.id, table: 'destinations', rowId: dest.id, confidence: 0.75 });
  newDestinationId = dest.id;
  const item = db.insert('itinerary_items', {
    destinationId: dest.id,
    day: dates.start,
    kind: 'transit',       // or 'lodging'/'activity' depending on what the segment actually is
    title: '...',
  });
  db.insert('document_extractions', { documentId: doc.id, table: 'itinerary_items', rowId: item.id, confidence: 0.75 });
  extractedSomething = true;
}
```

`'passport_visa'` writes a `knowledge_notes` row summarizing validity/entry rules — never a
`bookings` row. `'place_photo'`/`'other'` writes a low-confidence `knowledge_notes` candidate only
when `doc.content` has actual readable text; otherwise leave `extractedSomething` false. Never
fabricate a value the text doesn't support — see `extraction/provenance`'s `confidence-and-safety`
guidance before writing anything uncertain as a domain row.

Close out the document and resolve:

```ts
db.update('documents', {
  where: { id: doc.id },
  set: extractedSomething
    ? { status: 'analyzed', summary: `Extracted data from this ${kind.replace(/_/g, ' ')} document.` }
    : { status: 'error', error: 'no extractable data found in this document' },
});
// The new destination id (if any) is recoverable from the document_extractions rows this task
// wrote (table === 'destinations'), so the research-followup task reads it back rather than
// threading it through this task's output — keeping the output schema a simple { ok }.
void newDestinationId;
currentTask.resolve({ ok: extractedSomething });
```
