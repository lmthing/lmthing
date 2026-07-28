---
id: report
goal: true
dependsOn: [load, scan, record]
role: plan
functions: []
output:
  summary: string
  recorded: number
  autoResolved: number
  stillOpen: number
  ok: boolean
---

Report the sweep honestly, from upstream numbers only — including tables that could not be checked:

```ts
const branches = (scan ?? []).filter((b: any) => b && typeof b === 'object');
const unscanned = branches.filter((b: any) => b.scanned === false).length;
```

```ts
currentTask.resolve({
  summary:
    `Checked ${load.ruleCount} active rules across ${branches.length} tables: ` +
    `${record.recorded} new violations, ${record.autoResolved} auto-resolved, ${record.stillOpen} still open` +
    (unscanned > 0
      ? `. ${unscanned} tables could not be scanned (they no longer exist) — their violations were left untouched, not verified`
      : '') +
    `.`,
  recorded: record.recorded,
  autoResolved: record.autoResolved,
  stillOpen: record.stillOpen,
  ok: record.ok === true,
});
```

Zero new violations is a normal, good outcome — report it as such, never as a failure. Never imply
an unscanned table was verified.
