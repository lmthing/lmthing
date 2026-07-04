---
variable: extractionGuidance
description: How to read an uploaded health document and extract structured rows by kind, with provenance.
---

# Extraction discipline

Every row the records team writes from an uploaded document starts life as unstructured text —
`documents.content` — and the analyst's whole job is turning that text into the right shape in the
right table, without ever inventing a number or a name that isn't actually there. That discipline
has four parts:

1. **Identify the kind first.** `detectKind` gives a fast heuristic guess from the filename and the
   text itself, but the analyst always treats it as a starting point, not gospel — a `.csv` file
   that turns out to be a doctor's typed note pasted into a spreadsheet is still a note, not a
   wearable export. Confirm the kind actually matches the content before choosing an extraction
   path.

2. **Parse deterministically wherever the shape allows it.** A wearable CSV export has a fixed,
   machine-readable column order — use `parseCsv` rather than hand-rolling comma-splitting logic in
   the moment, so the same input always produces the same rows. Free text (a lab report, a note, a
   label) has no fixed shape, so it calls for careful reading rather than a parser — see
   `lab-report-parsing.md` for how to read a lab report specifically.

3. **Record provenance for every derived row.** A `document_extractions` row is not optional
   bookkeeping — it is what makes re-analysis idempotent and what lets a later reader trace any
   `lab_results`/`metrics`/`medications` row back to the exact document it came from. See
   `provenance.md` for the mechanics and why it matters.

4. **Never fabricate, and say so when you can't read something.** If a value in the source text is
   illegible, ambiguous, or simply absent, the correct move is to skip that value (or the whole
   document, with an honest `error` reason) — never to estimate a number that looks plausible.
   `documents.status` exists precisely so the user can see the difference between "analyzed
   cleanly" and "couldn't read this."

The end state for every document is one of two outcomes: `status: 'analyzed'` with a markdown
`summary` of what was actually found and written, or `status: 'error'` with a short, honest
`error` explaining what couldn't be read. A document is never left `pending` or `analyzing` once a
run has touched it — that's what keeps the self-query pass idempotent across a burst of uploads.
