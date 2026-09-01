# Policies — snapshots, retention, and why one of them waits for a human

A policy is one row in `archive_policies`: `{ targetTable, snapshotEnabled, retentionColumn,
keepDays, status, createdAt }`. `bind` creates one per table, always in the same shape:

```
{ snapshotEnabled: true, retentionColumn: '', keepDays: 0, status: 'proposed' }
```

## Why retention is never proposed automatically

The space can find date columns. It cannot find *meaning*. `orders.created_at` and
`sessions.created_at` are the same column shape and opposite decisions: one is a business record
somebody must keep for years, the other is noise that could go tomorrow. Nothing in a schema
distinguishes them.

The costs are also asymmetric. A missing retention policy is an inconvenience the user fixes in a
minute. A wrong one produces a confident list saying "these 4,000 rows have aged out" — and the
list is the thing people act on. So:

- `retentionColumn` and `keepDays` are set by the user, in `review`, or they stay unset.
- `retention-scan` skips every policy where they are unset. After `bind`, that is every policy —
  and a run that reports "no policy has a retention window set" is the space working correctly.
- Before writing a retention column, `review` verifies the column actually parses as dates in that
  table. A policy on a column that never parses reports nothing, forever, silently.

Snapshots default ON because a snapshot only ever ADDS a copy: the failure mode is storage, not
loss. Retention defaults OFF because its output is a list of things to remove.

## Cadence — a daily cron with a weekly gate

`hooks/weekly-snapshot.ts` fires `snapshot` **daily at 05:30**; the tasklist's first step gates on
`new Date().getUTCDay() === 0` and resolves `shouldRun: false` on any other day. The gate lives in
the tasklist, not in the schedule, for three reasons: running the action by hand on a Wednesday
behaves identically, the retry story is "wait for next Sunday" instead of "hope the one fire
worked", and the whole rule is testable.

`getUTCDay`, never `getDay` — the pod's local timezone is not the user's, and a snapshot that
shifts by a day depending on where the container runs is not a weekly snapshot.

The gate's dependents must survive a closed gate: `02-load` carries `condition:
"gate.shouldRun == true"`, and the goal step guards with `typeof capture === 'undefined'` because a
skipped dependency still lets a dependent run. A closed gate is a successful run.

## Size honesty

`archive_snapshots.dataJson` holds the **entire table** serialized as stable JSON. That is the
point — a snapshot you can diff and restore from — and it means a 50 MB table produces a 50 MB row,
every Sunday.

So: say it out loud before the user activates a policy on something large, and offer
`snapshotEnabled: false` for high-volume tables (event logs, telemetry, anything append-only and
huge). Never solve the size problem by truncating `dataJson` — a partial snapshot is worse than no
snapshot, because it looks complete. And never solve it by deleting old snapshots: there is no
delete on this surface, and pruning is the user's decision.

## Idempotency

- `bind`: a `targetTable` that already has ANY policy row is skipped, whatever its status. Re-bind
  never duplicates a policy and never wipes a retention window the user configured.
- `snapshot` / `retention-scan` / `pii-scan`: `computeArchiveKey(kind, table, day)` truncates to
  the day, so each produces at most one row per table per day. Check-before-insert on
  `snapshotKey` / `reportKey` is mandatory, every time.
