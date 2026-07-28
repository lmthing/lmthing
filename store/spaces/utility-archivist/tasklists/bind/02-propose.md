---
id: propose
dependsOn: [inventory]
role: plan
functions: []
output:
  policies: array
  policyCount: number
---

Turn the inventory into policy proposals. The rule is fixed, and it is deliberately boring — every
inventoried table gets exactly this:

```ts
const policies = Object.keys(inventory.samples).map(name => ({
  targetTable: name,
  snapshotEnabled: true,
  retentionColumn: '',
  keepDays: 0,
  status: 'proposed',
}));
currentTask.resolve({ policies, policyCount: policies.length });
```

**Retention is never proposed automatically.** A date column that parses is not a signal that the
data behind it is safe to age out: `orders.created_at` is a business record, `sessions.created_at`
is noise, and the column names give you no way to tell them apart. Only the person who owns the
data knows which is which, and the cost of guessing is asymmetric — a missing policy is an
inconvenience, a wrong one is a list telling someone their real records are ready to be deleted.
So `retentionColumn` stays `''` and `keepDays` stays `0` until a human sets them in the archivist's
`review` action, and `retention-scan` skips every policy where they are unset.

Snapshots are proposed ON because a snapshot only ever ADDS a copy — the failure mode is storage,
not loss, and the user sees exactly what it costs in the bind report.

Every policy lands as `status: 'proposed'`: nothing in this space acts on a policy until the user
activates it. Do not add tables that were not inventoried, do not skip tables because they look
uninteresting, and do not set a retention window "as a sensible default".
