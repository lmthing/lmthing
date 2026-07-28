---
id: report
goal: true
dependsOn: [gate, record]
role: plan
functions: []
output:
  summary: string
  recorded: number
  ok: boolean
---

Report the close honestly, from upstream numbers only. This step must ALWAYS resolve — including
on the 30 days a month when nothing runs.

On a non-closing day `record` was SKIPPED by its condition chain, so its variable is not defined at
all. Guard on that FIRST — `typeof record === 'undefined'` — and never read `record.recorded`
before the guard:

```ts
if (typeof record === 'undefined') {
  currentTask.resolve({
    summary: `Not the 1st of the month (${gate.nowIso}) — nothing closed. The next close will cover ${gate.label}.`,
    recorded: 0,
    ok: true,
  });
}
```

Otherwise report the real numbers:

```ts
currentTask.resolve({
  summary:
    `Closed ${gate.label} (${gate.periodStart} → ${gate.periodEnd}, end exclusive): ` +
    `${record.recorded} reports recorded, ${record.duplicates} already existed` +
    (record.overBudget > 0 ? `, ${record.overBudget} over budget` : '') +
    (record.staleBindings > 0
      ? `, ${record.staleBindings} bindings point at tables that no longer exist (flag them in review)`
      : '') +
    `.`,
  recorded: record.recorded,
  ok: record.ok === true,
});
```

A skipped day is a success, not a failure — say so plainly and do not dress it up as work done.
Zero new reports on an actual closing day is also normal (nothing changed, or the month was already
closed): report it as such.
