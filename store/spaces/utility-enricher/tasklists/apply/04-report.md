---
id: report
goal: true
dependsOn: [load, mark]
role: plan
functions: []
output:
  summary: string
  applied: number
  ok: boolean
---

Report exactly what changed in the user's data — this is the one action that touched their tables,
so understate nothing:

```ts
currentTask.resolve({
  summary:
    `Applied ${mark.applied} of ${load.count} approved values` +
    (mark.skipped > 0
      ? `; ${mark.skipped} were skipped (the cell was filled in the meantime, the row is gone, or the value no longer validates) and are still listed in review with the reason`
      : '') +
    `.`,
  applied: mark.applied,
  ok: mark.ok === true,
});
```

Never claim a value landed unless a branch resolved `applied: true`. Skips are expected and are
worth naming individually when there are only a few — they are the guardrail working, not a fault.
