---
id: plan_legs
output:
  ok: boolean
  written: number
dependsOn: [order_destinations]
role: general
---

Write the transit legs for the pairs `order_destinations` produced (available as
`order_destinations.pairs`, each a `{ tripId, fromDestinationId, toDestinationId }`). Do it in a
**single loop in this task** — insert each leg with `db.insert` directly (you hold `db:write` on
`transit_legs`). Do **not** use `remember`/`recall`/`readFileRaw` — the only durable store is the
project db via `db.*`.

```ts
const pairs = order_destinations.pairs ?? [];
let written = 0;
for (const pair of pairs) {
  // Skip a hop already planned (`where` is equality-only).
  const existing = db.query('transit_legs', { where: { toDestinationId: pair.toDestinationId } });
  if (existing.length) continue;

  const to = db.query('destinations', { where: { id: pair.toDestinationId } })[0];
  const from = pair.fromDestinationId ? db.query('destinations', { where: { id: pair.fromDestinationId } })[0] : null;

  // Ground the hop with webSearch when you can ("Lisbon to Porto train duration price"); if a
  // search is slow or empty, still write a clearly-labelled estimate rather than skipping — a
  // short intercity hop is typically a train or a 1–3h drive.
  db.insert('transit_legs', {
    tripId: pair.tripId,
    fromDestinationId: pair.fromDestinationId,
    toDestinationId: pair.toDestinationId,
    mode: 'train',            // read/estimate from the route: 'flight'|'train'|'bus'|'car'|'ferry'|'walk'
    durationMinutes: 180,     // estimate or searched value
    estimatedCost: 30,        // estimate or searched value
    currency: 'EUR',
    notes: (from ? from.name : 'origin') + ' → ' + (to ? to.name : '') + ' — rough estimate, verify fares',
    status: 'suggested',
  });
  written++;
}
currentTask.resolve({ ok: true, written });
```

Prefer writing a clearly-labelled estimate over writing nothing: a suggested leg the traveller can
adjust beats an empty transit view. Replace the placeholder `mode`/`durationMinutes`/`estimatedCost`
with real values from a `webSearch` of each route when time allows, and cite the source in `notes`.
