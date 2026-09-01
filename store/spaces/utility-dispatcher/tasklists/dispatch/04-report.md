---
id: report
goal: true
dependsOn: [load, deliver]
role: plan
functions: []
output:
  summary: string
  delivered: number
  ok: boolean
---

Report the run honestly, from upstream numbers only:

```ts
currentTask.resolve({
  summary:
    `Checked ${load.ruleCount} active rules: ${deliver.delivered} digests delivered, ` +
    `${deliver.empty} had nothing new` +
    (deliver.failed > 0 ? `, ${deliver.failed} deliveries FAILED (they will be retried on the next run)` : '') +
    (deliver.skipped > 0 ? `, ${deliver.skipped} rules point at a table that no longer exists` : '') +
    `.`,
  delivered: deliver.delivered,
  ok: deliver.ok === true && deliver.failed === 0,
});
```

A run that delivered nothing because nothing was new is a success — say so plainly. Never present a
failed delivery as a success, and never omit it from the summary.
