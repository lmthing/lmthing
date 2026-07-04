---
id: trends
output:
  trends: array
dependsOn: [gather]
functions:
  - computeTrend
---

Group `gather.metrics` by `kind` and compute a rolling trend for each — the percent move from the
earliest to the most recent recent reading in that kind, sorted chronologically:

```ts
const byKind = new Map();
for (const m of gather.metrics) {
  const list = byKind.get(m.kind) ?? [];
  list.push(m);
  byKind.set(m.kind, list);
}
```

```ts
const trends = [];
for (const [kind, list] of byKind) {
  const sorted = list.slice().sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));
  const changePct = computeTrend(sorted.map((m) => m.value));
  trends.push({ metricKind: kind, changePct, count: sorted.length });
}
currentTask.resolve({ trends });
```

A `kind` with only one reading yields `changePct: 0` from `computeTrend` itself — `write-insights`
should treat that as "nothing to say yet," not as a genuinely flat trend.
