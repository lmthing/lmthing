---
id: write
output:
  written: number
dependsOn: [research]
role: general
goal: true
---

Persist each researched finding onto its `interactions` row and mark it `ready`. `research` is in
scope as the array of every fanned-out branch's resolved `{ rowId, otherName, severity, summary,
sources }`:

```ts
const results = Array.isArray(research) ? research : [research];
let written = 0;
for (const r of results) {
  const links = r.sources.map((s) => `- [${s.title}](${s.url})`).join('\n');
  const body = `## ${r.otherName}\n\n${r.summary}\n\n_This is not medical advice — discuss any change with your prescriber or pharmacist._\n\n## Sources\n\n${links}`;
  db.update('interactions', {
    where: { id: r.rowId },
    set: { body, otherName: r.otherName, severity: r.severity, status: 'ready' },
  });
  written++;
}
currentTask.resolve({ written });
```

This is the tasklist's goal task — `written` is what the `review` tasklist reports back to
whatever triggered it. This update is self-write-excluded from `hooks/check-interactions.ts`
(insert-only), so the whole tasklist is bounded to one reconcile per run — it never re-triggers
itself.
