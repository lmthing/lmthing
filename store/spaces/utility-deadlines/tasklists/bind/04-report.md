---
id: report
goal: true
dependsOn: [inventory, propose, persist]
role: plan
functions: []
output:
  summary: string
  activeCount: number
  proposedCount: number
  ok: boolean
---

Report what binding actually did — honestly, from the upstream numbers only:

```ts
const active = propose.watchers.filter((w: any) => w.status === 'active').length;
const proposed = propose.watchers.filter((w: any) => w.status === 'proposed').length;
currentTask.resolve({
  summary:
    `Scanned ${inventory.tableCount} tables; ${propose.candidateCount} date-like candidates. ` +
    `Persisted ${persist.inserted} new watchers (${persist.skippedExisting} already existed): ` +
    `${active} active, ${proposed} proposed — proposed ones await the keeper's review action.`,
  activeCount: active,
  proposedCount: proposed,
  ok: persist.ok === true,
});
```

Never inflate: if nothing was found or persisted, say exactly that.
