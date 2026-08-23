---
id: review
dependsOn: [plan]
condition: plan.count > 20
output:
  verdict: string
---

A plan this large needs a second look before it is summarized. Say in one sentence whether
the angles in `plan.angles` overlap enough to be worth merging.

This node exists to demonstrate the `condition` gate: `plan` always returns three angles, so
`plan.count > 20` is false and the compiled workflow SKIPS this node — `review` reaches the
summarize node as `null`, and no agent is ever spawned for it.
