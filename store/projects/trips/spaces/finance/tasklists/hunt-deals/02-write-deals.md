---
id: write_deals
output:
  ok: boolean
  written: number
dependsOn: [scan_trip]
role: general
---

Write the `deals` rows from `scan_trip`'s `found` list, skipping anything too similar to an already
`'active'` deal for this trip (same `kind` + `title`) so re-running the tasklist doesn't pile up
duplicates:

```ts
const existing = db.query('deals', { where: { tripId } });
const already = new Set(existing.filter(d => d.status === 'active').map(d => d.kind + '::' + d.title));

let written = 0;
for (const deal of scan_trip.found) {
  const key = deal.kind + '::' + deal.title;
  if (already.has(key)) continue;

  db.insert('deals', {
    tripId,
    kind: deal.kind,
    title: deal.title,
    description: deal.description,
    estimatedSavings: deal.estimatedSavings ?? 0,
    currency: deal.currency ?? 'USD',
    url: deal.url,
    status: 'active',
  });
  written++;
}
currentTask.resolve({ ok: true, written });
```
