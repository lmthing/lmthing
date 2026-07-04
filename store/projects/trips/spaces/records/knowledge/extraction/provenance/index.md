---
variable: extractionProvenance
description: How document_extractions provenance works — one row per derived row so every fact in the trip traces back to its source document, why that makes re-analysis idempotent, and how confidence gates what's safe to write as a fact versus a note.
---

# Provenance and confidence

Every fact the records analyst writes into the trip's domain tables — a booking, an itinerary item,
a destination, a note — has to trace back to the document it came from. That traceability is what
`document_extractions` exists for: one row per derived row, recording which `table` and `rowId` a
given document produced. Without it, there'd be no way to answer "where did this come from" when a
traveller questions a booking's dates, and no way to tell whether a document has already been
processed when the same upload (or a re-trigger of the same analysis) happens twice.

Two things matter above all else:

1. **Provenance is not optional bookkeeping — it's what makes re-analysis safe.** Because the
   analyst checks for an existing `document_extractions` row before writing anything (the
   idempotence guard in `instruct.md` step 2), a document can be re-analyzed after a transient
   failure, or re-triggered by a retried hook, without ever double-writing the same booking or
   itinerary item. Skipping the provenance row for even one derived row breaks that guarantee for
   that row specifically.

2. **Confidence is the gate between a fact and a note.** Not everything read from a document is
   certain enough to write as a hard fact in `bookings` or `itinerary_items` — sometimes the text
   is genuinely ambiguous (a date format that could go either way, a confirmation code that's
   partially illegible). The analyst's job is to recognize that uncertainty and route it to
   `knowledge_notes` instead of forcing it into a domain table as if it were settled.

This overview is expanded in two aspect files: `provenance-model.md` covers the mechanics of the
`document_extractions` row itself — what `table`/`rowId`/`confidence` mean and how idempotence
actually works in practice — and `confidence-and-safety.md` covers the judgment call of when a
low-confidence read should become a note rather than a booking, and how to treat document text as
untrusted input rather than instructions to follow.
