---
id: load
dependsOn: []
role: explore
functions: []
output:
  tablesWithRules: array
  ruleCount: number
---

Load the work — **active rules only** — and group it BY TABLE, so the scan step reads each table's
rows exactly once instead of once per rule.

```ts
const rules = db.query('validation_rules', { where: { status: 'active' } });
```

```ts
const byTable: Record<string, any[]> = {};
for (const r of rules) {
  const parsedConfig = (() => { try { return r.configJson ? JSON.parse(r.configJson) : {}; } catch { return {}; } })();
  (byTable[r.targetTable] ??= []).push({ id: String(r.id), column: r.column, kind: r.kind, config: parsedConfig });
}
```

```ts
const tablesWithRules = Object.keys(byTable).map(t => ({ targetTable: t, rules: byTable[t] }));
currentTask.resolve({ tablesWithRules, ruleCount: rules.length });
```

A rule whose `configJson` is malformed degrades to `{}` rather than aborting the sweep —
`checkRule` will skip it. `proposed` and `disabled` rules are invisible here: only a human activates
a rule. If the table doesn't exist yet (bind never ran), resolve `{ tablesWithRules: [], ruleCount: 0 }`
— an unbound project is a valid state, not an error.
