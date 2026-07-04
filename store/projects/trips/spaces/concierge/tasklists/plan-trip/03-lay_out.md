---
id: lay_out
output:
  ok: boolean
dependsOn: [propose_destinations, research_each]
role: general
canDelegateTo:
  - concierge/scheduler#lay-out
---

Delegate the scheduler to lay out the per-day itinerary once destinations exist and have been
researched:

```ts
await delegate('concierge/scheduler', 'lay-out', { input: { tripId } });
currentTask.resolve({ ok: true });
```

The trip's `status` may be left as `'planning'` here — the planner or a later user action can move
it to `'booked'` once real reservations exist.
