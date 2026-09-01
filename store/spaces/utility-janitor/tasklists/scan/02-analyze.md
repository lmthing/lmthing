---
id: analyze
dependsOn: [inventory]
forEach: inventory.tableNames
optional: true
role: explore
functions:
  - findDuplicateGroups
  - normalizeCellValue
  - findOrphanRows
output:
  table: string
  findings: array
---

Analyze ONE table (`item` is its name) with the pure detectors. Read-only here — recording is the
next step's job. Every finding you resolve must come from a function's return value; never from
your own reading of a row.

Load the table's rows once (`where` is equality-only — you want all of them, and the functions do
the filtering in memory):

```ts
const rows = db.query(item);
const findings: any[] = [];
```

1. **Duplicates** — the natural key is the FIRST of `email`, `name`, `title`, `label` the table
   actually has. No such column → no duplicate detection for this table:

```ts
const cols = Object.keys(rows[0] ?? {});
const keyCol = ['email', 'name', 'title', 'label'].find(c => cols.includes(c));
```

```ts
for (const g of (keyCol ? findDuplicateGroups(rows, [keyCol]) : [])) {
  findings.push({
    targetTable: item,
    rowId: g.rowIds[0],
    kind: 'duplicate',
    detail: `${keyCol}="${g.key}" shared by rows ${g.rowIds.join(', ')}`,
    patchJson: '',
  });
}
```

2. **Normalization** — every string column, per row, with the kind implied by the column name.
   Record a finding ONLY where the function reports `changed: true`:

```ts
const kindFor = (c: string): string =>
  /mail/i.test(c) ? 'email' : /phone|tel|mobile/i.test(c) ? 'phone' : /date|_at$|_on$/i.test(c) ? 'date' : 'whitespace';
```

```ts
for (const row of rows) {
  for (const c of Object.keys(row)) {
    if (c === 'id' || typeof row[c] !== 'string') continue;
    const r = normalizeCellValue(kindFor(c), row[c]);
    if (!r.changed) continue;
    findings.push({
      targetTable: item, rowId: String(row.id), kind: 'normalize',
      detail: c, patchJson: JSON.stringify({ [c]: r.value }),
    });
  }
}
```

3. **Orphans** — foreign keys are columns named `<name>_id` / `<name>Id` whose prefix matches
   another table's name (singular or plural tolerant). Load that parent table's ids and check:

```ts
const tableNames: string[] = inventory.tableNames;
const parentFor = (c: string): string | undefined => {
  const base = c.replace(/(_id|Id)$/, '').toLowerCase();
  return tableNames.find(t => { const n = t.toLowerCase(); return n === base || n === base + 's' || n + 's' === base; });
};
```

```ts
for (const c of cols) {
  if (!/(_id|Id)$/.test(c) || c === 'id') continue;
  const parent = parentFor(c);
  if (!parent) continue;
  const parentIds = db.query(parent).map((p: any) => p.id);
  for (const o of findOrphanRows(rows, c, parentIds)) {
    findings.push({
      targetTable: item, rowId: o.rowId, kind: 'orphan',
      detail: `${c}=${o.fkValue} has no matching row in ${parent}`,
      patchJson: '',
    });
  }
}
```

```ts
currentTask.resolve({ table: item, findings });
```

`patchJson` is a JSON string of `{column: normalizedValue}` for `normalize` findings and `''` for
everything else — a duplicate or an orphan is a human decision, so it carries no patch. Never
invent a patch for one, and never widen a normalize patch beyond the single column that changed.
