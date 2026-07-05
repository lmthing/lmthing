---
id: write_notes
output:
  ok: boolean
dependsOn: [scan_travelers]
role: general
---

Write (or refresh) this trip's single "Party preferences & constraints" `knowledge_notes` row from
`scan_travelers`'s merged view — replace an existing one rather than piling up duplicates each time
a preference changes. Do this in a **single pass**, not a `forEach` fork (you hold `db:write` on
`knowledge_notes`):

```ts
const existing = db.query('knowledge_notes', { where: { tripId } })
  .find(n => n.topic === 'Party preferences & constraints');

const body = scan_travelers.merged
  .map(g => `**${g.category}**: ${g.values.join(', ')}`)
  .join('\n\n') + '\n\n(source: traveler-recorded preferences)';

if (existing) {
  db.update('knowledge_notes', { where: { id: existing.id }, set: { body } });
} else {
  db.insert('knowledge_notes', {
    tripId,
    topic: 'Party preferences & constraints',
    body,
    sourceKind: 'companions',
  });
}

currentTask.resolve({ ok: true });
```
