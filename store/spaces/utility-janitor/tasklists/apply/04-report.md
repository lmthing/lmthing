---
id: report
goal: true
dependsOn: [load, mark]
role: plan
functions: []
output:
  summary: string
  applied: number
  ok: boolean
---

Report the apply pass honestly, from upstream numbers only — including what did NOT work:

```ts
currentTask.resolve({
  summary:
    `${load.count} approved findings loaded; ${mark.marked} patches applied and marked` +
    (mark.failed > 0
      ? `, ${mark.failed} left as approved (malformed patch, or a duplicate/orphan finding whose resolution is yours to make)`
      : '') +
    `. Proposed findings were not touched.`,
  applied: mark.marked,
  ok: mark.ok === true,
});
```

Zero applied is a normal outcome (nothing approved yet). Never round a failure up into a success,
and never imply a `proposed` finding was considered — it wasn't.
