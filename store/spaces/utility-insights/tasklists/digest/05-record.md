---
id: record
dependsOn: [gate, compose]
condition: "gate.shouldRun == true"
role: general
capabilities: [db:read, db:write, db:schema]
functions: []
output:
  recorded: number
  duplicate: boolean
  ok: boolean
---

Record the composed report as ONE `insight_reports` row — check-before-insert, every time.

1. Ensure this space's own table exists (create only when absent):

```ts
const existing = db.tables().map((t: any) => (typeof t === 'string' ? t : t.name));
```

```ts
if (!existing.includes('insight_reports')) {
  db.createTable('insight_reports', {
    period: 'string', generatedAt: 'string', summary: 'string',
    highlightsJson: 'string', dedupeKey: 'string', status: 'string', createdAt: 'string',
  });
}
```

2. One report per ISO week. The key is the week, so a second run on the same Monday — or a retry
   after a crash — records nothing:

```ts
const dedupeKey = `week:${gate.weekLabel}`;
const already = db.query('insight_reports', { where: { dedupeKey } });
```

```ts
if (already.length > 0) {
  currentTask.resolve({ recorded: 0, duplicate: true, ok: true });
}
```

```ts
const now = new Date().toISOString();
db.insert('insight_reports', {
  period: gate.weekLabel,
  generatedAt: gate.nowIso,
  summary: compose.summary,
  highlightsJson: compose.highlightsJson,
  dedupeKey,
  status: 'open',
  createdAt: now,
});
currentTask.resolve({ recorded: 1, duplicate: false, ok: true });
```

Insert the summary exactly as `compose` produced it — never edit, pad, or "improve" the text here.
Write ONLY `insight_reports` — no host-app table, ever (the grant enforces this; don't fight the
typecheck). An empty `compose.summary` is still recorded: a row saying the week was quiet is the
honest record. The insert auto-emits `project/db.insight_reports.insert` for downstream consumers —
that emission IS the delivery path; do not attempt any notification yourself.
