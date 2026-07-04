---
id: extract
output:
  documentId: string
  extracted: number
dependsOn: [load-pending]
forEach: load-pending.pending
role: general
functions:
  - parseCsv
  - detectKind
goal: true
---

Fans out over each pending document produced by `load-pending`. `item` is one `documents` row —
claim it, confirm its kind, extract what the text actually supports, and record a
`document_extractions` row for every derived row, following `records/extraction` guidance.

```ts
const doc = item;
db.update('documents', { where: { id: doc.id }, set: { status: 'analyzing' } });
const kind = detectKind(doc.filename, doc.content);
let extracted = 0;
```

`wearable_csv` parses deterministically:

```ts
if (kind === 'wearable_csv') {
  const rows = parseCsv(doc.content);
  for (const row of rows) {
    const existing = db.query('metrics', { where: { kind: row.kind, recordedAt: row.recordedAt } })[0];
    if (existing) continue; // dedupe on kind + recordedAt — a re-uploaded export shouldn't double-count
    const metric = db.insert('metrics', { ...row, source: doc.filename });
    db.insert('document_extractions', { documentId: doc.id, targetTable: 'metrics', rowId: metric.id, confidence: 0.95 });
    extracted++;
  }
}
```

`lab_pdf`, `med_label`, and `note_text` call for reading the text yourself (no deterministic
parser) — for each row you can genuinely support from `doc.content`, insert it into the matching
table (`lab_results` — never set `flag`, `medications`, or a `symptoms` row for a note that
actually names one) and record a `document_extractions` row alongside it, incrementing `extracted`.
Never fabricate a value the text doesn't support.

Close out the document:

```ts
if (extracted === 0 && kind === 'other') {
  db.update('documents', { where: { id: doc.id }, set: { status: 'error', error: 'document was empty or unreadable' } });
} else {
  db.update('documents', {
    where: { id: doc.id },
    set: { status: 'analyzed', summary: `Extracted ${extracted} row(s) from this ${kind.replace(/_/g, ' ')} document.` },
  });
}
currentTask.resolve({ documentId: doc.id, extracted });
```

This task is the tasklist's `goal` — its resolved values across the fan-out are what the run is
actually for; `provenance` only double-checks the bookkeeping afterward.
