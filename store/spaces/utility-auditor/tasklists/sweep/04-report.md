---
id: report
goal: true
dependsOn: [load, record]
role: plan
functions: []
output:
  summary: string
  changes: number
  ok: boolean
---

Report the sweep honestly, from upstream numbers only:

```ts
const changes = record.added + record.changed + record.removed;
currentTask.resolve({
  summary:
    `Swept ${load.bindings.length} audited tables as of ${load.nowIso}: ` +
    `${record.added} added, ${record.changed} changed, ${record.removed} removed` +
    (record.baselined > 0 ? `; ${record.baselined} tables baselined (first sweep — snapshots seeded, nothing logged)` : '') +
    (record.duplicates > 0 ? `; ${record.duplicates} already logged today` : '') +
    (record.staleBindings > 0
      ? `; ${record.staleBindings} bindings point at tables that no longer exist (flag them in review)`
      : '') +
    `.`,
  changes,
  ok: record.ok === true,
});
```

Zero changes is a normal, good outcome — report it as such, never as a failure. A baselined table
is not "no changes found": say it was baselined, so nobody reads today's silence as evidence that
nothing has ever happened in that table.
