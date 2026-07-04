# Note standards

## What makes a good note

A `knowledge_notes` row should read like a single encyclopedia entry, not a research report:

- **One topic per note.** "Elevated LDL cholesterol" is a note; "Elevated LDL cholesterol AND
  elevated A1c" is two notes, even if the same research dive happened to touch both — splitting
  keeps each note reusable on its own the next time only one of those topics comes up.
- **Cited, always.** Every note's `body` ends with a `## Sources` list of links — carried over from
  the `research` row(s) it was distilled from. A note with no citation is not durable knowledge, it's
  an unsupported claim; don't write one.
- **Concise.** A note is a few short paragraphs, not a full copy of the research report it came
  from — distil the substance (what it means, what the literature broadly says) rather than pasting
  the dive verbatim.
- **No diagnosis.** A note describes what a lab value or topic generally means according to the
  literature ("elevated LDL is generally associated with increased cardiovascular risk over time")
  — it never tells the reader what they specifically have, what to do about it, or what to take.
  Close with the same not-medical-advice framing the rest of the records/clinic/coaching spaces use.

## Tagging for surfacing

Set `analyte` whenever the note is about a specific lab analyte (e.g. `'LDL Cholesterol'`, matching
the `lab_results.analyte` spelling) — this is what lets the note surface automatically next to a
matching lab result elsewhere in the app. Use `tag` for a broader, non-analyte grouping (e.g. a
symptom cluster or a medication class) when `analyte` doesn't apply. A note with neither is much
less useful — it can only ever be found by browsing, not by the analyte/topic match that makes
curated knowledge actually pay off.
