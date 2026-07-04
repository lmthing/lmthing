# Provenance

## Why every derived row gets a document_extractions row

`document_extractions` is the traceability layer that makes the rest of the extraction discipline
possible. Without it:

- A user (or a future agent) looking at a `lab_results` or `metrics` row would have no way to know
  which uploaded document it came from, or how confident the extraction was.
- Re-running the analyst over a document that was already analyzed would have no way to tell
  "already extracted this" from "haven't touched this yet" — the pass would either skip real work
  or duplicate it.

So the rule is simple and non-negotiable: **every row the analyst inserts into a domain table
(`lab_results`, `metrics`, `medications`, `symptoms`) gets exactly one matching
`document_extractions` row**, written in the same pass, pointing `targetTable` at the domain table
name and `rowId` at the id just inserted.

## Confidence

`confidence` (0..1, default 0.5) is the analyst's own honest estimate of how sure it is that the
extracted value is correct — not a formality. A cleanly parsed CSV row deserves a high confidence
(close to 1); a lab value read from a blurry OCR'd scan, or a note where the unit was ambiguous,
deserves something meaningfully lower. This number is what lets a future feature (or a human
reviewer) triage low-confidence extractions for a second look, so resist the temptation to default
everything to `0.5` out of habit — think about each value's actual legibility.

## Idempotent re-analysis

Because provenance exists, re-running the analyst over the whole `documents` table (the normal
self-query pass, since the hook carries no id) is safe: a document already `status: 'analyzed'`
is simply skipped, so nothing gets extracted twice. If a document ever needs to be re-processed
(e.g. a correction), that is a deliberate future feature — not something the analyst should do on
its own by resetting a document back to `pending`.
