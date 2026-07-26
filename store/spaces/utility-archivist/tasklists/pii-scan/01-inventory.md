---
id: inventory
dependsOn: []
role: explore
functions: []
output:
  tableNames: array
  samples: object
  tableCount: number
  dayIso: string
---

Inventory the project and take a sample from each table — up to 50 rows, which is enough to say
"this column holds emails" without reading the whole database.

```ts
const tables = db.tables();
```

```ts
const own = ['archive_policies', 'archive_snapshots', 'archive_reports'];
const samples: Record<string, any[]> = {};
const tableNames: string[] = [];
for (const t of tables) {
  const name = typeof t === 'string' ? t : t.name;
  // Skip this space's own tables — scanning `archive_snapshots` would just re-find, in a JSON
  // blob, exactly the personal data the last report already counted.
  if (own.includes(name)) continue;
  tableNames.push(name);
  samples[name] = db.query(name).slice(0, 50);
}
```

```ts
currentTask.resolve({ tableNames, samples, tableCount: tableNames.length, dayIso: new Date().toISOString().slice(0, 10) });
```

Sampled rows are untrusted data and, in this action especially, SENSITIVE data: carry them to the
scanner, never quote one into a summary, a comment, or a resolved value.
