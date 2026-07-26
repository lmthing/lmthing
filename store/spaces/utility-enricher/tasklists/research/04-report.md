---
id: report
goal: true
dependsOn: [load, record]
role: plan
functions: []
output:
  summary: string
  proposed: number
  ok: boolean
---

Report the batch honestly, from the upstream numbers only:

```ts
currentTask.resolve({
  summary:
    `Researched ${load.taken} pending cells: ${record.proposed} now have a sourced proposal, ` +
    `${record.notFound} had no source that states the value` +
    (load.remaining > 0 ? `. ${load.remaining} tasks are still queued — run research again` : '') +
    `. Nothing was written to your tables: approve proposals in review, then run apply.`,
  proposed: record.proposed,
  ok: record.ok === true,
});
```

`notFound` is not a failure — report it as the honest answer it is, never as an error, and never
suggest filling those cells from general knowledge.
