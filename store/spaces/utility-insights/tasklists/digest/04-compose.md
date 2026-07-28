---
id: compose
dependsOn: [gate, analyze]
condition: "gate.shouldRun == true"
role: plan
functions:
  - formatReportMarkdown
output:
  summary: string
  highlightsJson: string
  highlightCount: number
---

Compose the week's report. `analyze` is the collected fan-out output: one `{ table, profile,
numericSummaries, outlierCount }` per table (a skipped branch contributes nothing).

**You may use ONLY the numbers already in `analyze`.** Do not re-open the database, do not
recompute, do not estimate, and do not describe a trend — this digest has no previous period to
compare against, and inventing one is fabrication.

```ts
const branches = (analyze ?? []).filter((b: any) => b && typeof b === 'object');
const profiles = branches.map((b: any) => b.profile);
```

Build the highlight lines mechanically from what the functions returned — one per numeric column
that actually summarized, plus one per table with outliers:

```ts
const highlights: { label: string; detail: string }[] = [];
for (const b of branches) {
  for (const [col, s] of Object.entries<any>(b.numericSummaries ?? {})) {
    if (!s || s.count === 0) continue;
    highlights.push({
      label: `${b.table}.${col}`,
      detail: `${s.count} values · min ${s.min} · median ${s.median} · mean ${s.mean} · max ${s.max} · sum ${s.sum}`,
    });
  }
  if (b.outlierCount > 0) {
    highlights.push({ label: `${b.table}`, detail: `${b.outlierCount} outlier value(s) outside 1.5×IQR` });
  }
}
```

```ts
const summary = formatReportMarkdown(profiles, highlights, gate.weekLabel);
currentTask.resolve({ summary, highlightsJson: JSON.stringify(highlights), highlightCount: highlights.length });
```

If there is nothing to say, say nothing: `formatReportMarkdown` returns `''` for an empty profile
with no highlights — resolve that empty string rather than writing a paragraph of filler. A quiet
week is a real result.
