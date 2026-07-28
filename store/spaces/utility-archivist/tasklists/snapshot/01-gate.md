---
id: gate
dependsOn: []
role: plan
functions: []
output:
  shouldRun: boolean
  nowIso: string
  dayIso: string
---

Decide whether this is a snapshot day, and fix the run's reference instant ONCE so every branch of
the fan-out agrees on which day it is.

The cron fires daily; snapshots are weekly. The gate — not the schedule — is what makes them
weekly, so that running the action by hand on a Wednesday behaves the same way and a missed Sunday
simply waits for the next one.

```ts
const now = new Date();
const nowIso = now.toISOString();
const dayIso = nowIso.slice(0, 10);
```

```ts
// Sunday in UTC. Use getUTCDay(), never getDay(): the pod's local timezone is not the user's, and
// a snapshot that shifts by a day depending on where the container runs is not a weekly snapshot.
const shouldRun = now.getUTCDay() === 0;
currentTask.resolve({ shouldRun, nowIso, dayIso });
```

Resolve honestly — `shouldRun: false` is the normal answer on six days out of seven, and the report
step handles it. Never force the gate open because "there is no snapshot yet"; the dedupe key
already makes a same-day re-run harmless, and the cadence is the user's policy, not your judgement.
