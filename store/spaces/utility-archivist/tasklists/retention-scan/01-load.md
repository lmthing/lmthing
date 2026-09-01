---
id: load
dependsOn: []
role: explore
functions: []
output:
  policies: array
  count: number
  nowIso: string
  dayIso: string
---

Load the work — `active` policies that the user has actually configured for retention — and fix
the run's reference instant ONCE, so every branch of the fan-out computes ages against the same
clock.

```ts
const active = db.query('archive_policies', { where: { status: 'active' } });
```

```ts
// `where` is equality-only, so the real filter happens in memory. Both conditions matter: an
// unset retentionColumn or a keepDays of 0 means "the user has not decided yet", and a policy that
// has not been decided is never scanned.
const policies = active.filter(
  (p: any) => String(p.retentionColumn ?? '').trim() !== '' && Number(p.keepDays) > 0,
);
```

```ts
const nowIso = new Date().toISOString();
currentTask.resolve({ policies, count: policies.length, nowIso, dayIso: nowIso.slice(0, 10) });
```

If `archive_policies` does not exist yet, or no policy has retention configured, resolve
`{ policies: [], count: 0, nowIso, dayIso }` — that is the DEFAULT state after bind, not an error,
and it is the state the space is designed to sit in until a human chooses otherwise.
