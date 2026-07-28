---
id: gate
dependsOn: []
role: plan
functions: []
output:
  shouldRun: boolean
  nowIso: string
  weekLabel: string
---

Decide whether today is digest day, and fix the run's identity ONCE.

`hooks/weekly-digest.ts` fires this action **every morning** — the cron primitive is daily, there is
no weekly one. This gate is what makes the digest weekly: it lets the run continue only on **Monday
(UTC)**, and every expensive step downstream is conditioned on `gate.shouldRun`. On the other six
mornings the tasklist stops here, having cost one cheap episode.

```ts
const now = new Date();
const shouldRun = now.getUTCDay() === 1; // 0 = Sunday, 1 = Monday
```

Compute the ISO-8601 week label (`YYYY-Www`) inline — it is this run's dedupe identity, so it must
be derived, never guessed. ISO rule: the week's Thursday decides the year, and week 1 is the week
containing 4 January.

```ts
const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
d.setUTCDate(d.getUTCDate() - dayNum + 3); // → the Thursday of this week
```

```ts
const isoYear = d.getUTCFullYear();
const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
```

```ts
currentTask.resolve({
  shouldRun,
  nowIso: now.toISOString(),
  weekLabel: `${isoYear}-W${String(week).padStart(2, '0')}`,
});
```

Resolve honestly: when `shouldRun` is false, still resolve with the real `nowIso` and `weekLabel` —
the final report reads them to explain why nothing ran. Never force `shouldRun` to true "to be
useful"; an off-day run would write a second row for the same week.
