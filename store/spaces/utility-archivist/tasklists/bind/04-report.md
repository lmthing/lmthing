---
id: report
goal: true
dependsOn: [inventory, propose, persist]
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
    `Inventoried ${inventory.tableCount} tables and proposed ${propose.policyCount} archive policies ` +
    `(${persist.inserted} new, ${persist.skippedExisting} already had one). ` +
    `Every policy is 'proposed' with snapshots on and NO retention window — retention is never ` +
    `set automatically, because only you know which data is safe to age out. Activate policies and ` +
    `set retention in the archivist's review action; nothing is snapshotted or scanned until then.`,
  proposedCount: propose.policyCount,
  ok: persist.ok === true,
});
```

Say plainly that snapshots store the full table as JSON, so a big table means a big row — the user
should turn snapshots off for anything large before activating. Never inflate: if nothing was found
or persisted, say exactly that.
