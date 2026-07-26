---
id: report
goal: true
dependsOn: [gate, record]
role: plan
functions: []
output:
  summary: string
  ok: boolean
---

Close the run honestly. This node has **no `condition`** on purpose: it must run on every firing,
including the six mornings a week the gate stops the digest.

A dependency that was skipped by its `condition` still counts as satisfied — a task is ready when
every `dependsOn` entry is done **or skipped** — so depending on `record` is safe, but on a non-run
day `record` never resolved and its variable is **undefined**. Guard before you read it, and never
read `inventory`, `analyze` or `compose` at all: they are not in `dependsOn`, so they are not
injected here.

```ts
const recorded = typeof record === 'undefined' ? null : record;
```

```ts
if (gate.shouldRun !== true) {
  currentTask.resolve({
    summary: `Not Monday (${gate.nowIso}) — no digest. The next digest covers week ${gate.weekLabel} and runs on the coming Monday.`,
    ok: true,
  });
}
```

```ts
currentTask.resolve({
  summary: recorded === null
    ? `Digest for ${gate.weekLabel} ran but the recording step produced no result — nothing was written.`
    : recorded.duplicate === true
      ? `Digest for ${gate.weekLabel} already recorded — nothing new written (dedupe on week:${gate.weekLabel}).`
      : `Digest for ${gate.weekLabel} recorded: ${recorded.recorded} new insight_reports row.`,
  ok: recorded === null ? false : recorded.ok === true,
});
```

Report what actually happened, never what was intended. "Not Monday, no digest" is a successful
outcome (`ok: true`) — a skipped day is not a failure. A missing `record` result IS a failure and
must be reported as `ok: false`.
