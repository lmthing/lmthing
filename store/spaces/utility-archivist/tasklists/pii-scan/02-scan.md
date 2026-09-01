---
id: scan
dependsOn: [inventory]
forEach: inventory.tableNames
optional: true
role: explore
functions:
  - scanPiiInRows
output:
  targetTable: string
  findings: array
  findingCount: number
---

Scan ONE table (`item` is the table name) for personal-data shapes. The function does all the
matching; you do none of it by eye.

```ts
const rows = inventory.samples[item] ?? [];
const findings = scanPiiInRows(rows);
currentTask.resolve({ targetTable: item, findings, findingCount: findings.length });
```

`findings` is `{ column, kind, count }[]` — that is the entire result, and it is deliberately the
entire result. **The matched values never leave `scanPiiInRows`.** Do not re-scan the rows yourself
to "confirm" a finding, do not include an example value, and do not describe one in prose ("the
emails look like company addresses" is a leak).

Do not reclassify: a Luhn-valid 16-digit run is reported as `card`, which means *card-shaped*, not
*confirmed card number*. The report is a place to look, not a verdict.
