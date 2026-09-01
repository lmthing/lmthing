---
id: report
goal: true
dependsOn: [load, record]
role: plan
functions: []
output:
  summary: string
  recorded: number
  ok: boolean
---

Report the sweep honestly, from upstream numbers only:

```ts
currentTask.resolve({
  summary:
    `Swept ${load.watchers.length} active watchers as of ${load.nowIso}: ` +
    `${record.recorded} new alerts recorded, ${record.duplicates} already known` +
    (record.staleWatchers > 0
      ? `, ${record.staleWatchers} watchers point at tables that no longer exist (flag them in review)`
      : '') +
    `.`,
  recorded: record.recorded,
  ok: record.ok === true,
});
```

Zero new alerts is a normal, good outcome — report it as such, never as a failure.
