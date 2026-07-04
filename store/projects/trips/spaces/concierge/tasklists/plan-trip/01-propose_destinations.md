---
id: propose_destinations
output:
  destinationIds: array
dependsOn: []
role: general
canDelegateTo:
  - concierge/scheduler#propose
---

Delegate the scheduler to write the destinations from the trip's brief, then collect the new
destination ids for the fan-out that follows. `tripId` is in scope from the tasklist input.

```ts
const r = await delegate('concierge/scheduler', 'propose', { input: { tripId } });
currentTask.resolve({ destinationIds: r.destinationIds ?? [] });
```
