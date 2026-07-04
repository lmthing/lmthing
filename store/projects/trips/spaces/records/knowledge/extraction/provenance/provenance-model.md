# The provenance model

## One row per derived row, no exceptions

Every time the analyst inserts a row into `bookings`, `itinerary_items`, `destinations`, or
`knowledge_notes` as a result of reading a document, that insert is immediately followed by an
insert into `document_extractions` recording `documentId` (the source), `table` (the name of the
domain table just written to), `rowId` (the primary key of the row just inserted), and `confidence`
(a 0..1 estimate of how sure the extraction was). This is a strict pairing — if a document produces
three `itinerary_items` rows and one `bookings` row, that's four `document_extractions` rows in the
same pass, not one summary row for the document as a whole. The granularity matters because a
traveller (or a later reconciliation pass) needs to be able to ask "which specific rows did this
document produce" and get an exact answer, not just "this document was processed."

## Confidence is a real number, not a formality

`confidence` should reflect the actual certainty of the read, not default to a fixed value out of
habit:

- **~0.9 and above** — the source text states the fact plainly and unambiguously (an explicit
  confirmation code next to explicit dates; a passport expiry date printed as a labeled field).
- **~0.7–0.85** — the fact is clearly present but required some inference (a cost computed by
  summing a nightly rate across a stated number of nights; a destination name normalized from an
  airport code).
- **Below ~0.5** — genuinely uncertain (a smudged or truncated confirmation code, a date format
  that's ambiguous between two readings, text that implies a booking exists but doesn't clearly
  confirm it). Confidence in this range is exactly the signal that should route the fact to
  `knowledge_notes` instead of a domain table — see `confidence-and-safety.md`.

A confidence value isn't just descriptive metadata; it's what a future reconciliation or audit pass
would use to decide which extractions are worth spot-checking against the source document again.

## Idempotence in practice

The analyst's guard — checking `document_extractions` for any row already referencing `documentId`
before writing anything — is what makes the `analyze` action safe to invoke more than once for the
same document (a retried hook, a user re-triggering analysis after fixing an upload). Because the
check happens before any domain-table insert, a partially-completed prior run (one that inserted a
booking but crashed before recording its `document_extractions` row) is the one case idempotence
doesn't fully protect against — which is exactly why the insert order matters: write the domain row,
then immediately write its `document_extractions` row, in that order, so the two stay as tightly
coupled in time as the code allows. Reordering them (writing provenance first, or batching all
provenance inserts to the end of the pass) widens the window where a crash leaves an orphaned
domain row with no provenance trail.

## Provenance is read-only history, never edited

Once written, a `document_extractions` row is never updated or deleted by the analyst — it's a
historical record of what happened during a specific analysis pass. If a later document supersedes
an earlier one (a corrected booking confirmation replacing an original with a wrong date), that's a
new document producing new rows with their own new provenance entries, not an edit to the old
extraction record. The domain row itself (`bookings`, etc.) may reasonably be updated or replaced,
but the trail of which document produced which original row should stay intact.
