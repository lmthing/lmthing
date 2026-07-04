---
id: write_list
output:
  ok: boolean
dependsOn: [assess]
role: general
---

Write the `packing_items` rows from `assess`'s `needs`, skipping any label already on the trip's
list:

```ts
const existing = db.query('packing_items', { where: { tripId } });
const already = new Set(existing.map(p => p.label));

for (const need of assess.needs) {
  if (!already.has(need.label)) {
    db.insert('packing_items', {
      tripId,
      label: need.label,
      category: need.category,
      reason: need.reason,
      packed: false,
    });
  }
}

currentTask.resolve({ ok: true });
```
