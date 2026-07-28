---
id: report
goal: true
dependsOn: [inventory, persist]
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
    `Saw ${inventory.totalTables} tables (${inventory.excluded} skipped as utility bookkeeping). ` +
    `Proposed ${persist.inserted} new audit bindings (${persist.skippedExisting} already existed). ` +
    `Nothing is swept until a binding is activated — the first sweep of a table only takes a ` +
    `baseline snapshot and logs no changes.`,
  proposedCount: persist.inserted,
  ok: persist.ok === true,
});
```

Never inflate: if nothing was found or persisted, say exactly that.
