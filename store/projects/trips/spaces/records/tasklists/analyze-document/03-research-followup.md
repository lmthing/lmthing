---
id: research_followup
output:
  ok: boolean
dependsOn: [extract]
optional: true
canDelegateTo:
  - concierge/researcher#dive
---

If `extract` created any new destinations, delegate the researcher to dive into each — a document
that turns out to name a place the trip hasn't visited yet (a new city on a forwarded itinerary)
should get the same grounded research as one the planner proposed directly. Recover the new
destination ids from the provenance rows `extract` wrote (`document_extractions` where
`table === 'destinations'`) — `documentId` is in scope from the tasklist input:

```ts
const provenance = db.query('document_extractions', { where: { documentId } });
const newDestIds = provenance.filter(p => p.table === 'destinations').map(p => p.rowId);
for (const destinationId of newDestIds) {
  await delegate('concierge', 'researcher', 'dive', { context: { destinationId } });
}
currentTask.resolve({ ok: true });
```

This task is `optional` — a flaky research delegate must not sink the document analysis, which has
already fully completed by the time this task runs.
