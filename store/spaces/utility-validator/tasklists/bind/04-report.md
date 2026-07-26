---
id: report
goal: true
dependsOn: [inventory, suggest, persist]
role: plan
functions: []
output:
  summary: string
  proposedCount: number
  ok: boolean
---

Report what binding actually did — honestly, from the upstream numbers only:

```ts
currentTask.resolve({
  summary:
    `Sampled ${inventory.tableCount} tables; ${suggest.ruleCount} rules derived from the evidence. ` +
    `Persisted ${persist.inserted} new rules (${persist.skippedExisting} already existed) — all as ` +
    `proposed. None is active yet: run the inspector's review action to activate the ones you agree ` +
    `with, then check runs daily.`,
  proposedCount: persist.inserted,
  ok: persist.ok === true,
});
```

Never inflate: if nothing was derived or persisted, say exactly that — and never describe a
proposed rule as if it were already enforcing anything.
