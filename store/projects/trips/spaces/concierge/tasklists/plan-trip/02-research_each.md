---
id: research_each
output:
  ok: boolean
dependsOn: [propose_destinations]
forEach: propose_destinations.destinationIds
optional: true
role: general
canDelegateTo:
  - concierge/researcher#dive
---

Fans out over each destination id produced by `propose_destinations`. `item` is one destination
id — delegate the researcher to dive into it:

```ts
await delegate('concierge/researcher', 'dive', { input: { destinationId: item } });
currentTask.resolve({ ok: true });
```

This task is `optional` — one flaky destination (a search that turns up nothing, a fetch that
times out) must not sink the whole trip.
