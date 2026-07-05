---
id: group_and_write
dependsOn: [load_shopping_list]
role: general
output:
  tripId: string
  estimatedCost: number
---

Group the gap lines by aisle in a sensible store-walk order and total the estimated cost — per
`shopping-optimization/aisle-and-cost`, never hand-roll a different aisle order or rounding scheme
than the one the rest of the app uses:

```ts
const AISLE_ORDER = ['produce', 'dairy', 'meat', 'bakery', 'pantry', 'frozen', 'other'];

const byCategory = new Map<string, typeof load_shopping_list.lines>();
for (const line of load_shopping_list.lines) {
  const key = line.category || 'other';
  if (!byCategory.has(key)) byCategory.set(key, []);
  byCategory.get(key)!.push(line);
}

const known = AISLE_ORDER.filter((aisle) => byCategory.has(aisle));
const unknown = [...byCategory.keys()].filter((k) => !AISLE_ORDER.includes(k));
const organized = [...known, ...unknown].map((aisle) => ({ aisle, lines: byCategory.get(aisle)! }));

const estimatedCost = Math.round(
  load_shopping_list.lines.reduce((sum, l) => sum + l.estCost, 0) * 100,
) / 100;
```

```ts
const trip = db.insert('shopping_trips', {
  planId: load_shopping_list.planId,
  organized,
  estimatedCost,
  status: 'ready',
});
currentTask.resolve({ tripId: trip.id, estimatedCost });
```

Guardrails:

- Preserve `AISLE_ORDER`'s produce → dairy → meat → bakery → pantry → frozen → other sequence — it's
  the store-walk order the rest of the app assumes; never reorder aisles by cost or alphabetically.
  Any category outside that list is appended after the known aisles rather than dropped.
- Round `estimatedCost` to cents — never surface a long floating-point tail to the user.
- This task only ever writes `shopping_trips` — it never touches `shopping_list.bought` or any
  ingredient quantity.
