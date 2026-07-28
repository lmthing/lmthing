---
id: record
dependsOn: [scan]
role: general
capabilities: [db:read, db:write]
functions:
  - computeArchiveKey
output:
  recorded: number
  duplicates: number
  stalePolicies: number
  ok: boolean
---

Record one `archive_reports` row per table per day — check-before-insert on `reportKey`, every
time. `scan` is the collected fan-out output: one
`{ targetTable, candidates, candidateCount, tableMissing }` per policy (a skipped branch
contributes nothing).

```ts
const branches = (scan ?? []).filter((b: any) => b && typeof b === 'object' && b.targetTable);
const stalePolicies = branches.filter((b: any) => b.tableMissing === true).length;
```

```ts
let recorded = 0, duplicates = 0;
const now = new Date().toISOString();
const day = now.slice(0, 10);
for (const b of branches) {
  if (b.tableMissing === true || (b.candidateCount ?? 0) === 0) continue; // nothing to report
  const key = computeArchiveKey('retention', b.targetTable, day);
  const existing = db.query('archive_reports', { where: { reportKey: key } });
  if (existing.length > 0) { duplicates++; continue; }
  db.insert('archive_reports', {
    kind: 'retention',
    targetTable: b.targetTable,
    // Ids and ages only — this is a list of rows to look at, not a copy of their contents.
    detailJson: JSON.stringify({ count: b.candidateCount, candidates: b.candidates }),
    reportKey: key,
    status: 'open',
    createdAt: now,
  });
  recorded++;
}
currentTask.resolve({ recorded, duplicates, stalePolicies, ok: true });
```

Write ONLY `archive_reports` here. **Do not delete, update, or move a single host row** — there is
no delete on your surface at all, and that is the design: this report tells the user which rows
have aged past the window they set, and they act on it in their own app. Never widen `detailJson`
to include row contents, and never mark a report anything but `open` (closing one is a `review`
decision).
