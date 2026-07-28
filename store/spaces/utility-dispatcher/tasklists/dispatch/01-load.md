---
id: load
dependsOn: []
role: explore
functions: []
output:
  rules: array
  ruleCount: number
---

Load the deliverable rules and each one's watermark. A rule is deliverable only when it is
`active` AND carries a non-empty `channelRef` — anything else is configuration that never fires.

```ts
const active = db.query('dispatch_rules', { where: { status: 'active' } });
const deliverable = active.filter((r: any) => typeof r.channelRef === 'string' && r.channelRef !== '');
```

The watermark is the most recent successful log row for that rule. `where` is equality-only, so
sort in memory:

```ts
const rules = deliverable.map((r: any) => {
  const logs = db.query('dispatch_log', { where: { ruleId: String(r.id) } })
    .filter((l: any) => l.status === 'sent')
    .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    ruleId: String(r.id),
    sourceTable: r.sourceTable,
    channelRef: r.channelRef,
    channelHint: r.channelHint ?? '',
    label: r.label ?? r.sourceTable,
    lastSeenCreatedAt: logs.length > 0 ? String(logs[0].lastSeenCreatedAt ?? '') : '',
  };
});
currentTask.resolve({ rules, ruleCount: rules.length });
```

If `dispatch_rules` does not exist yet (bind never ran), resolve `{ rules: [], ruleCount: 0 }` — an
unconfigured dispatcher is a valid state, not an error.
