---
id: gate
dependsOn: []
role: plan
functions:
  - previousMonthRange
output:
  shouldRun: boolean
  periodStart: string
  periodEnd: string
  label: string
  nowIso: string
---

Decide whether today is a closing day, and fix the period ONCE so every downstream step computes
against the same month.

The hook is a DAILY cron — cron has no day-of-month field — so the month gate lives here:

```ts
const nowIso = new Date().toISOString();
const shouldRun = new Date().getUTCDate() === 1;
```

Resolve the previous-month range **regardless of the gate**. Downstream steps read `gate.periodStart`
and `gate.label` in their prompts and in the final report; leaving them empty on a non-closing day
would make the report unable to say *which* month it skipped:

```ts
const range = previousMonthRange(nowIso);
currentTask.resolve({
  shouldRun,
  periodStart: range?.periodStart ?? '',
  periodEnd: range?.periodEnd ?? '',
  label: range?.label ?? '',
  nowIso,
});
```

Do not re-derive the month arithmetic inline — `previousMonthRange` handles the January → previous
December rollover and the UTC boundaries. Do not "helpfully" run the close on the 2nd because the
1st was missed: a missed month is recoverable by a manual `close` run (the dedupe key makes it
safe), a silently shifted period is not.
