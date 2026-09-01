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
  tablesWithFindings: number
  ok: boolean
---

Record one `archive_reports` row per table per day — for tables that actually had findings, and
with counts only.

```ts
const branches = (scan ?? []).filter((b: any) => b && typeof b === 'object' && b.targetTable);
const withFindings = branches.filter((b: any) => (b.findingCount ?? 0) > 0);
```

```ts
let recorded = 0, duplicates = 0;
const now = new Date().toISOString();
const day = now.slice(0, 10);
for (const b of withFindings) {
  const key = computeArchiveKey('pii', b.targetTable, day);
  const existing = db.query('archive_reports', { where: { reportKey: key } });
  if (existing.length > 0) { duplicates++; continue; }
  // detailJson holds column + kind + count. NOTHING ELSE — never a matched value, never a sample,
  // never a redacted excerpt. A report that quotes the data it found is a second copy of the
  // problem, stored in a table nobody is watching.
  const detail = b.findings.map((f: any) => ({ column: f.column, kind: f.kind, count: f.count }));
  db.insert('archive_reports', {
    kind: 'pii',
    targetTable: b.targetTable,
    detailJson: JSON.stringify(detail),
    reportKey: key,
    status: 'open',
    createdAt: now,
  });
  recorded++;
}
currentTask.resolve({ recorded, duplicates, tablesWithFindings: withFindings.length, ok: true });
```

A table with no findings gets **no row** — an empty report is noise, and the absence of a report is
itself readable. Write ONLY `archive_reports`; never touch a host-app table, and never mark a
report anything but `open` (closing one is a `review` decision).
