# Lab report parsing

## Locating the analyte lines

A typed or OCR'd lab report is mostly noise (headers, footers, patient demographics, lab
letterhead) around a small number of lines that actually matter — each one naming an **analyte**,
its measured **value** and **unit**, and usually a **reference range**. A line worth extracting
tends to look like one of:

```
LDL Cholesterol      142 mg/dL      (Ref: 0-99)
Hemoglobin A1c       6.1 %          Reference Range: 4.0-5.6
Glucose, Fasting     108 mg/dL      70-99
```

Read for the pattern — a name, a number, a unit, and (often but not always) two bounds — rather
than expecting one exact layout. When a reference range is split across "low" and "high" values,
map them to `refLow`/`refHigh`; when the report only gives a single cutoff ("< 100 mg/dL"), set
whichever bound the text actually states and leave the other blank rather than inventing a
matching one.

## Common panels, so names don't get mis-parsed

Reports usually group analytes under a panel name — recognizing the common ones helps tell a real
analyte line from a section header:

- **Lipid panel** — Total Cholesterol, LDL, HDL, Triglycerides.
- **CBC (complete blood count)** — WBC, RBC, Hemoglobin, Hematocrit, Platelets.
- **Metabolic panel** — Glucose, Sodium, Potassium, Creatinine, BUN.
- **HbA1c** — usually a single-analyte report on its own.

Use the panel name the report itself gives (verbatim or lightly normalized) for `lab_results.panel`
— don't guess a panel for an analyte the report doesn't group under one.

## What the analyst does NOT set

Never set `lab_results.flag` — that column belongs entirely to the clinic space's interpreter,
which computes it from `value` against `refLow`/`refHigh` once the row exists. Writing a flag here
would just be overwritten (or, worse, briefly wrong) and blurs which agent owns which column.

## Queuing a deeper look

When an analyte is out of its stated reference range, or is a kind of test the app hasn't seen
before (no matching `knowledge_notes.analyte`), insert a `research` row
(`{ labResultId, topic: '<analyte> out of range', status: 'pending' }`) so the dive can happen
asynchronously. This is the same `research` table the clinic space's interpreter and researcher
already use — inserting into it fires `hooks/research-deep-dive.ts`, which is how the actual
literature dive gets done. The analyst queues the question; it does not answer it.
