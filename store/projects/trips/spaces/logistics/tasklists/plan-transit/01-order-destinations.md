---
id: order_destinations
output:
  pairs: array
dependsOn: []
role: plan
---

Read the trip's destinations in visit order and produce the ordered from→to pairs the next task
fans out over — including the implicit origin→first-destination leg. `tripId` is in scope from the
tasklist input. **Carry `tripId` inside each pair** so the fan-out fork has it without depending on
the seed variable surviving into the fork:

```ts
const dests = db.query('destinations', { where: { tripId } })
  .sort((a, b) => a.orderIndex - b.orderIndex);

const pairs = dests.length
  ? [
      { tripId, fromDestinationId: null, toDestinationId: dests[0].id },
      ...dests.slice(0, -1).map((d, i) => ({ tripId, fromDestinationId: d.id, toDestinationId: dests[i + 1].id })),
    ]
  : [];

currentTask.resolve({ pairs });
```
