---
id: propose
dependsOn: [inventory]
role: plan
functions:
  - discoverScheduleColumns
output:
  bindings: array
  candidateCount: number
---

Turn the inventory into concrete binding proposals. The classification — including each column's
`kind` — is mechanical: run it, don't re-derive it:

```ts
const candidates = discoverScheduleColumns(inventory.tables, inventory.samples);
```

Then, per candidate, build the binding record deterministically from `planner/binding`'s rules. The
label column is the first of `name`, `title`, `label` actually present in that table's sampled keys —
never a column you did not see:

```ts
const bindings = candidates
  .filter(c => c.confidence >= 0.3)
  .map(c => {
    const sampleKeys = Object.keys((inventory.samples[c.table] ?? [])[0] ?? {});
    const labelColumn = ['name', 'title', 'label'].find(k => sampleKeys.includes(k)) ?? '';
    return {
      targetTable: c.table,
      targetColumn: c.column,
      labelColumn,
      kind: c.kind,
      confidence: c.confidence,
      status: c.confidence >= 0.8 ? 'active' : 'proposed',
    };
  });
currentTask.resolve({ bindings, candidateCount: candidates.length });
```

Do not add, drop, or re-rank candidates on intuition, and never override a `kind` because it "reads
better" — thresholds and classification come from the knowledge rules, verbatim. A wrongly-proposed
binding is cheap (the user reviews it); a silently invented one is not.
