---
id: classify
output:
  kind: string
dependsOn: []
role: plan
functions:
  - classifyKind
---

Read-only: load the document and confirm (or correct) its kind from the actual text using the
`classifyKind` heuristic parser — the client's guessed `kind` is a starting point, not gospel.
`documentId` is in scope from the tasklist input.

```ts
const doc = db.query('documents', { where: { id: documentId } })[0];
const guessed = classifyKind(doc.content ?? '');
// Trust the heuristic unless it fell back to 'other' while the client's own guess was more
// specific and nothing in the text actively contradicts it — a short pasted confirmation
// classifyKind can't confidently peg, but the upload flow already tagged 'booking_pdf', is safer
// left as the client's guess than downgraded to 'other'.
const kind = guessed === 'other' && doc.kind !== 'other' ? doc.kind : guessed;
currentTask.resolve({ kind });
```
