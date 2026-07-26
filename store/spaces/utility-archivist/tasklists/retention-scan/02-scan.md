---
id: scan
dependsOn: [load]
forEach: load.policies
optional: true
role: explore
functions:
  - findRetentionCandidates
output:
  targetTable: string
  candidates: array
  candidateCount: number
  tableMissing: boolean
---

Scan ONE policy (`item`) — read its table and run the day math. Read-only here; recording is the
next step's job, and there is no step that removes anything.

```ts
const tableNames = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!tableNames.includes(item.targetTable)) {
  // Schema drifted since the policy was set — report it; never fail the whole scan over one policy.
  currentTask.resolve({ targetTable: item.targetTable, candidates: [], candidateCount: 0, tableMissing: true });
}
```

```ts
const rows = db.query(item.targetTable);
const candidates = findRetentionCandidates(rows, item.retentionColumn, Number(item.keepDays), load.nowIso);
currentTask.resolve({
  targetTable: item.targetTable,
  candidates,
  candidateCount: candidates.length,
  tableMissing: false,
});
```

`where` is equality-only — you loaded ALL rows deliberately; `findRetentionCandidates` does the
filtering in memory, treats the boundary day as still-kept, and skips rows whose date does not
parse. Never re-implement that math inline, never round an `ageDays`, and never widen the window
because "these are clearly old". A row with an unparseable date is not a candidate — unknown age is
not old age.
