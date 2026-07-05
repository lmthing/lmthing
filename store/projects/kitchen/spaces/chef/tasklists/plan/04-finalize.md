---
id: finalize
dependsOn: [load_context, slot_day]
role: general
output:
  ok: boolean
---

Close out the run: mark the plan `ready` now that every day has either been slotted or explicitly
skipped for lack of candidates.

```ts
if (load_context.plan) {
  db.update('meal_plans', { where: { id: load_context.plan.id }, set: { status: 'ready' } });
}
currentTask.resolve({ ok: true });
```

This is the tasklist's terminal step — marking `status: 'ready'` here is what lets `pages/index.tsx`
and `pages/plan/[planId].tsx` stop polling `currentPlan` for a live-filling week.

Guardrails:

- Mark the plan `ready` even when `slot_day` skipped every day (empty recipe box) — a plan with
  zero `plan_meals` rows is still a legitimately "done" plan, not a stuck one.
- If `load_context.plan` was `null` (no such plan id), there's nothing to mark — just resolve
  `{ ok: true }` and stop.
