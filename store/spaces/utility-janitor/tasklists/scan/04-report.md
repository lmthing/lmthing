---
id: report
goal: true
dependsOn: [inventory, record]
role: plan
functions: []
output:
  summary: string
  recorded: number
  ok: boolean
---

Report what the scan actually did — honestly, from the upstream numbers only:

```ts
currentTask.resolve({
  summary:
    `Scanned ${inventory.tableNames.length} tables: ${record.recorded} new findings queued as ` +
    `proposed, ${record.duplicates} already known. Nothing in the app was changed — run the ` +
    `janitor's review action to approve or reject, then apply.`,
  recorded: record.recorded,
  ok: record.ok === true,
});
```

Zero findings is a normal, good outcome — report it as such, never as a failure. Never claim
anything was fixed: a scan fixes nothing by construction.
