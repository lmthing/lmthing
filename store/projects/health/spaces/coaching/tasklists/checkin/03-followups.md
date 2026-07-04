---
id: followups
output:
  proposed: number
dependsOn: [evaluate]
---

Close the loop on any goal `evaluate` found still short of its target: propose a follow-up unless
one is already open for it, per `coaching/behavior-change`'s `follow-through.md` (space follow-ups
out — never duplicate one that's already pending). `evaluate` is in scope as the array of every
fan-out branch's resolved `{ goalId, current, met }`:

```ts
const results = Array.isArray(evaluate) ? evaluate : [evaluate];
const short = results.filter((r) => r && r.met === false);

let proposed = 0;
for (const r of short) {
  const goal = db.query('goals', { where: { id: r.goalId } })[0];
  if (!goal) continue; // guard against a goal removed between evaluate and this step
  const topic = `Check in on: ${goal.title}`;
  const hasOpenFollowup = db.query('followups', {}).some((f) => !f.done && f.topic === topic);
  if (hasOpenFollowup) continue;
  db.insert('followups', {
    topic,
    reason: `${goal.title} isn't at its target yet (currently ${r.current}, target ${goal.target}).`,
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  proposed++;
}

currentTask.resolve({ proposed });
```

Neither the `goals` update `evaluate` already made nor this `followups` insert is watched by any
insert hook of the coach's own, so the whole `checkin` tasklist is bounded to one reconcile per run
— it never re-triggers itself.
