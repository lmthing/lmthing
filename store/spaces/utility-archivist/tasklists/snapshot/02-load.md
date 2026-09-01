---
id: load
dependsOn: [gate]
condition: "gate.shouldRun == true"
role: explore
functions: []
output:
  policies: array
  count: number
  nowIso: string
  dayIso: string
---

Load the work — `active` policies with snapshots enabled. This step only runs when the gate opened.
Carry the gate's instant through, so the per-table fan-out (which depends on this step, not on the
gate) writes one agreed day into every row.

```ts
const active = db.query('archive_policies', { where: { status: 'active' } });
```

```ts
// `where` is equality-only and `snapshotEnabled` may be stored as a boolean or as a string,
// depending on how the user's app wrote it — filter in memory and accept both truthy forms.
const policies = active.filter((p: any) => p.snapshotEnabled === true || p.snapshotEnabled === 'true');
currentTask.resolve({ policies, count: policies.length, nowIso: gate.nowIso, dayIso: gate.dayIso });
```

If `archive_policies` does not exist yet (bind never ran), or nothing is active, resolve
`{ policies: [], count: 0, nowIso: gate.nowIso, dayIso: gate.dayIso }` — an unbound project is a
valid state, not an error. Never widen the
filter to `proposed` policies: a policy the user has not activated is a policy that must not run.
