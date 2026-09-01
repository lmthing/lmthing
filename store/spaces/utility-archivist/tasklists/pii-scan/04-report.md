---
id: report
goal: true
dependsOn: [inventory, scan, record]
role: plan
functions: []
output:
  summary: string
  tablesWithFindings: number
  ok: boolean
---

Report which tables hold personal-data shapes and of which kinds — **never which values**:

```ts
const branches = (scan ?? []).filter((b: any) => b && typeof b === 'object' && b.targetTable);
```

```ts
// One line per affected table: the table, the kinds found, the counts. Nothing from a row.
const lines = branches
  .filter((b: any) => (b.findingCount ?? 0) > 0)
  .map((b: any) => `${b.targetTable}: ` + b.findings.map((f: any) => `${f.count}× ${f.kind} in ${f.column}`).join(', '));
```

```ts
currentTask.resolve({
  summary: lines.length === 0
    ? `Scanned ${inventory.tableCount} tables (up to 50 rows each) — no email, phone, IBAN or card-shaped values found.`
    : `Scanned ${inventory.tableCount} tables (up to 50 rows each). Personal-data shapes in ` +
      `${record.tablesWithFindings} of them — ${lines.join('; ')}. ` +
      `${record.recorded} new reports written, ${record.duplicates} already existed for today. ` +
      `Counts only: no matched value is stored or shown, and a shape is a shape — 'card' means ` +
      `card-shaped and Luhn-valid, not a confirmed card number.`,
  tablesWithFindings: record.tablesWithFindings,
  ok: record.ok === true,
});
```

Never include, paraphrase or partially mask a matched value in this summary. Zero findings is a
normal outcome and is worth stating plainly — it means the sample held none, not that the database
is clean.
