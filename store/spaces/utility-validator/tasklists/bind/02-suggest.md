---
id: suggest
dependsOn: [inventory]
role: plan
functions:
  - suggestRules
output:
  rules: array
  ruleCount: number
---

Turn the inventory into concrete rule proposals. The derivation is mechanical — run it, don't
re-derive it:

```ts
const rules = suggestRules(inventory.tables, inventory.samples);
currentTask.resolve({ rules, ruleCount: rules.length });
```

Every element is `{ targetTable, column, kind, config, evidence }`. Do not add, drop, re-rank or
"improve" a suggestion on intuition — the thresholds in `validator/rules` (10 sampled rows minimum,
100% fill for `required`, ≤ 6 distinct values for `enum`, 50%-widened bounds for `range`, an
existing parent table for `reference`) are the whole point. A table with too few rows correctly
yields nothing; that is a valid outcome, not a gap to fill by hand.

Never invent a rule the function did not return, and never drop the `evidence` string — a human
reviewing the proposal needs to check the claim, not trust it.
