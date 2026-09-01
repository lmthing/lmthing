---
id: propose
dependsOn: [inventory]
role: plan
functions:
  - discoverDateColumns
output:
  watchers: array
  candidateCount: number
---

Turn the inventory into concrete watcher proposals. The classification is mechanical — run it,
don't re-derive it:

```ts
const candidates = discoverDateColumns(inventory.tables, inventory.samples);
```

Then, per candidate, build the watcher record deterministically from `deadlines/binding`'s rules:

```ts
const leadFor = (col: string): number =>
  /expir|valid_|renew/i.test(col) ? 30 : /due|deadline|until/i.test(col) ? 14 : /start|end|date|_on$/i.test(col) ? 7 : 14;
```

```ts
const watchers = candidates
  .filter(c => c.confidence >= 0.3)
  .map(c => {
    const sampleKeys = Object.keys((inventory.samples[c.table] ?? [])[0] ?? {});
    const labelColumn = ['name', 'title', 'label'].find(k => sampleKeys.includes(k)) ?? '';
    return {
      targetTable: c.table,
      targetColumn: c.column,
      labelColumn,
      leadDays: leadFor(c.column),
      confidence: c.confidence,
      status: c.confidence >= 0.8 ? 'active' : 'proposed',
    };
  });
currentTask.resolve({ watchers, candidateCount: candidates.length });
```

Do not add, drop, or re-rank candidates on intuition — thresholds and lead windows come from the
knowledge rules, verbatim. A wrongly-proposed watcher is cheap (the user reviews it); a silently
invented one is not.
