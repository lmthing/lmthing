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

Report the scan honestly, from the upstream numbers only:

```ts
currentTask.resolve({
  summary: load.count === 0
    ? `No policy has a retention window set, so nothing was scanned. That is the default: retention ` +
      `is never configured automatically — set a column and a keep window in the archivist's review action.`
    : `Scanned ${load.count} policies as of ${load.dayIso}: ${record.recorded} new retention reports ` +
      `written, ${record.duplicates} already existed for today` +
      (record.stalePolicies > 0
        ? `, ${record.stalePolicies} policies point at tables that no longer exist (flag them in review)`
        : '') +
      `. Nothing was deleted — the reports name candidate rows for you to remove in your own app.`,
  recorded: record.recorded,
  ok: record.ok === true,
});
```

Zero candidates is a normal, good outcome — report it as such. Never suggest that you could delete
the candidates: you cannot, by design, and offering it would misrepresent the space.
