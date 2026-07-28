---
id: summarize
dependsOn: [load]
forEach: load.bindings
optional: true
role: explore
functions:
  - summarizePeriod
output:
  bindingId: string
  targetTable: string
  total: number
  count: number
  undated: boolean
  byCategoryJson: string
  tableMissing: boolean
---

Summarize ONE binding (`item`) over the gate's period — read its table, run the pure summation,
and hand the numbers to the recording step. Read-only here; recording is the next step's job.

```ts
const tableNames = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!tableNames.includes(item.targetTable)) {
  // Schema drifted since bind — report it; never fail the whole close over one stale binding.
  currentTask.resolve({
    bindingId: String(item.id), targetTable: item.targetTable, total: 0, count: 0,
    undated: false, byCategoryJson: '{}', tableMissing: true,
  });
}
```

```ts
const rows = db.query(item.targetTable);
const s = summarizePeriod(
  rows,
  item.amountColumn,
  item.dateColumn || null,
  item.categoryColumn || null,
  gate.periodStart,
  gate.periodEnd,
);
currentTask.resolve({
  bindingId: String(item.id),
  targetTable: item.targetTable,
  total: s.total,
  count: s.count,
  undated: s.undated,
  byCategoryJson: JSON.stringify(s.byCategory),
  tableMissing: false,
});
```

`where` is equality-only — you loaded ALL rows deliberately; `summarizePeriod` does the period
filtering in memory with `[periodStart, periodEnd)` calendar-day semantics. Never re-implement the
summation inline, never round a total yourself, and never adjust a number because it "looks off" —
if the total is wrong, the source rows are wrong, and they are not yours to edit.
