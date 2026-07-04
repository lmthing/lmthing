---
id: provenance
output:
  ok: boolean
dependsOn: [extract]
role: general
---

Sanity-check that every document touched by `extract` actually has matching provenance — a cheap
integrity pass, not a re-extraction. `extract`'s resolved values are available as an array, one
entry per fanned-out branch:

```ts
const results = Array.isArray(extract) ? extract : [extract];
let ok = true;
for (const r of results) {
  const count = db.query('document_extractions', { where: { documentId: r.documentId } }).length;
  if (r.extracted > 0 && count === 0) ok = false; // extraction claimed rows but left no provenance — a bug to notice, not silently accept
}
currentTask.resolve({ ok });
```
