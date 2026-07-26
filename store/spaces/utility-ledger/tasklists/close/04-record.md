---
id: record
dependsOn: [gate, load, summarize]
role: general
capabilities: [db:read, db:write]
functions:
  - computeReportKey
output:
  recorded: number
  duplicates: number
  overBudget: number
  staleBindings: number
  ok: boolean
---

Record each binding's period as a `ledger_reports` row — check-before-insert on `reportKey`, every
time. `summarize` is the collected fan-out output: one `{ bindingId, targetTable, total, count,
undated, byCategoryJson, tableMissing }` per binding (a skipped branch contributes nothing).

```ts
const branches = (summarize ?? []).filter((b: any) => b && typeof b === 'object');
const staleBindings = branches.filter((b: any) => b.tableMissing === true).length;
```

The over-budget flag is a lookup, not a judgement: a `ledger_budgets` row must EXIST for the
binding, and the period total must exceed its `monthlyLimit`. No budget row means `false` — an
absent limit is not a limit of zero.

```ts
let recorded = 0, duplicates = 0, overBudgetCount = 0;
const now = new Date().toISOString();
for (const b of branches) {
  if (b.tableMissing === true) continue;
  const key = computeReportKey(b.bindingId, gate.periodStart);
  const existing = db.query('ledger_reports', { where: { reportKey: key } });
  if (existing.length > 0) { duplicates++; continue; }
  const budget = (load.budgets ?? []).find((x: any) => String(x.bindingId) === String(b.bindingId));
  const overBudget = budget !== undefined && typeof budget.monthlyLimit === 'number' && b.total > budget.monthlyLimit;
  db.insert('ledger_reports', {
    bindingId: b.bindingId,
    periodStart: gate.periodStart,
    periodEnd: gate.periodEnd,
    total: b.total,
    count: b.count,
    byCategoryJson: b.byCategoryJson,
    overBudget,
    reportKey: key,
    status: 'open',
    createdAt: now,
  });
  if (overBudget) overBudgetCount++;
  recorded++;
}
currentTask.resolve({ recorded, duplicates, overBudget: overBudgetCount, staleBindings, ok: true });
```

Insert reports exactly as computed — never adjust a total, a count or a category split. Never
change a report's `status` here (that's a `review` decision), and never touch a host-app table:
making the source rows agree with a report is falsification, not bookkeeping. Each insert
auto-emits `project/db.ledger_reports.insert` for downstream consumers — that emission IS the
notification path; do not attempt any delivery yourself.
