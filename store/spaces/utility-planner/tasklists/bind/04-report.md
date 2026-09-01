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
const active = propose.bindings.filter((b: any) => b.status === 'active').length;
const proposed = propose.bindings.filter((b: any) => b.status === 'proposed').length;
currentTask.resolve({
  summary:
    `Scanned ${inventory.tableCount} tables; ${propose.candidateCount} schedule-like candidates. ` +
    `Persisted ${persist.inserted} new bindings (${persist.skippedExisting} already existed): ` +
    `${active} active, ${proposed} proposed — proposed ones stay out of the agenda until activated.`,
  activeCount: active,
  proposedCount: proposed,
  ok: persist.ok === true,
});
```

Never inflate: if nothing was found or persisted, say exactly that.
