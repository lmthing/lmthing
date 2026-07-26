---
id: report
goal: true
dependsOn: [load, mark]
role: plan
functions: []
output:
  summary: string
  routed: number
  ok: boolean
---

Report the pass honestly, from upstream numbers only:

```ts
currentTask.resolve({
  summary:
    `Triaged ${load.itemCount} pending items against ${load.rules.length} active rules: ` +
    `${mark.routed} routed, ${mark.unrouted} left unrouted` +
    (mark.unrouted > 0 ? ` (no rule matched — they wait in the triager's review action)` : '') +
    `.`,
  routed: mark.routed,
  ok: mark.ok === true,
});
```

Unrouted items are a normal outcome, not a failure — an inbox with no matching rule is exactly the
case the review action exists for. Never describe them as errors, and never imply they were
delivered somewhere.
