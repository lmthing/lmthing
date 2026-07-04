---
id: write-insights
output:
  written: number
dependsOn: [trends]
goal: true
---

Persist a notable trend (or a cautious correlation/anomaly, when evident) as an `insights` row for
each metric kind that moved meaningfully — deduping against what's already been written today so a
re-run of the digest doesn't pile up repeats.

```ts
const today = new Date().toISOString().slice(0, 10);
const existing = db.query('insights', {}).filter((i) => (i.createdAt ?? '').slice(0, 10) === today);
const alreadyCovered = new Set(existing.map((i) => i.metricKind).filter(Boolean));
```

```ts
let written = 0;
for (const t of trends.trends) {
  if (t.count < 2 || alreadyCovered.has(t.metricKind)) continue;
  if (Math.abs(t.changePct) < 5) continue; // roughly flat — not worth an insight
  const direction = t.changePct > 0 ? 'up' : 'down';
  db.insert('insights', {
    kind: 'trend',
    body: `${t.metricKind.replace(/_/g, ' ')} is ${direction} ~${Math.abs(t.changePct)}% over the period.`,
    metricKind: t.metricKind,
  });
  written++;
}
```

A cautious correlation or anomaly across two trending kinds (e.g. a metric trend that moves in step
with a newly-flagged lab) can be written the same way with `kind: 'correlation'` or
`kind: 'anomaly'` when the evidence is genuinely there — never invent a relationship between two
kinds that only coincidentally moved in the same run.

```ts
currentTask.resolve({ written });
```

This is the tasklist's goal task — `written` is what the digest run as a whole reports; the
interpreter's `digest` action still displays a short summary drawn from `gather`/`trends` alongside
this persisted count.
