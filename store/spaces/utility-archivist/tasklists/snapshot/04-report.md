---
id: report
goal: true
dependsOn: [gate, capture]
role: plan
functions: []
output:
  summary: string
  captured: number
  ok: boolean
---

Report the run — and this step must resolve on BOTH gate paths. `capture` is downstream of a
conditional step, so on a non-Sunday it never ran and its variable is not defined; a skipped
dependency still lets a dependent run, so guard before touching it rather than assuming a value.

```ts
const branches = typeof capture === 'undefined' ? [] : (capture ?? []).filter((b: any) => b && typeof b === 'object');
```

```ts
const captured = branches.filter((b: any) => b.captured === true).length;
const skipped = branches.length - captured;
```

```ts
currentTask.resolve({
  summary: gate.shouldRun !== true
    ? `Not a snapshot day (${gate.dayIso} is not a Sunday, UTC) — nothing was captured. This is the expected outcome on six days out of seven.`
    : `Snapshotted ${captured} tables on ${gate.dayIso}` +
      (skipped > 0 ? `; ${skipped} were skipped (already snapshotted today, or the table no longer exists)` : '') +
      `.`,
  captured,
  ok: true,
});
```

A closed gate is a successful run, not a failure — report it as such, and never re-open it by
capturing "just this once". Zero captures on a Sunday with no active policies is equally normal:
say that no policies are active and point at `review`.
