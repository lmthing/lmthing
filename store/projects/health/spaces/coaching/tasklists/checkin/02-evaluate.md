---
id: evaluate
output:
  goalId: string
  current: number
  met: boolean
dependsOn: [load-goals]
forEach: load-goals.goals
functions:
  - goalProgress
  - computeTrend
goal: true
---

Fans out over each active goal produced by `load-goals`. `item` is one goal row — pull its metric's
recent history and compute progress with `goalProgress`, then persist it onto the goal itself:

```ts
const goal = item;
if (!goal.metricKind) {
  // Not every goal is metric-linked yet — nothing to compute for this one.
  currentTask.resolve({ goalId: goal.id, current: goal.current ?? 0, met: goal.status === 'met' });
} else {
  const metrics = db.query('metrics', {}).filter((m) => m.kind === goal.metricKind);
  const current = goalProgress(metrics, goal.metricKind);
  const met = goal.target != null && (goal.target >= (goal.current ?? 0) ? current >= goal.target : current <= goal.target);

  db.update('goals', {
    where: { id: goal.id },
    set: met ? { current, status: 'met' } : { current },
  });

  currentTask.resolve({ goalId: goal.id, current, met });
}
```

`computeTrend` is available here for a finer read of the metric's recent direction (see
`coaching/baselines`'s `trend-detection.md`) — use it on `metrics`' recent slice when you want to
narrate, in a follow-up conversation, *why* a goal looks like it's moving the right way even though
it isn't `met` yet; the `met` boolean above only needs the plain current-vs-target comparison.

This is the tasklist's **goal task** (`goal: true`) — its resolved output (one `{ goalId, current,
met }` per goal, across the fan-out) is what the tasklist reports back to whatever triggered it,
even though `followups` still runs after it to close the loop on any goal still short of its target.
