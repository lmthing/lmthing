---
id: propose
dependsOn: [inventory]
role: plan
functions:
  - discoverAmountColumns
output:
  bindings: array
  candidateCount: number
---

Turn the inventory into concrete binding proposals. The classification is mechanical — run it,
don't re-derive it:

```ts
const candidates = discoverAmountColumns(inventory.tables, inventory.samples);
```

Then build the binding records deterministically from `ledger/binding`'s rules — the function
already chose the date and category siblings, the direction and the confidence; you only apply the
status thresholds:

```ts
const bindings = candidates
  .filter(c => c.confidence >= 0.3)
  .map(c => ({
    targetTable: c.table,
    amountColumn: c.amountColumn,
    dateColumn: c.dateColumn ?? '',
    categoryColumn: c.categoryColumn ?? '',
    direction: c.direction,
    confidence: c.confidence,
    status: c.confidence >= 0.8 ? 'active' : 'proposed',
  }));
currentTask.resolve({ bindings, candidateCount: candidates.length });
```

Do not add, drop, or re-rank candidates on intuition — thresholds come from the knowledge rules,
verbatim. Do not "fix" a `null` date column by picking one yourself: a dateless binding is a real
outcome and lands as `proposed` precisely so a human decides. A wrongly-proposed binding is cheap
(the user reviews it); a silently invented one is not.
