# utility-archivist — snapshots, retention candidates, PII visibility

A schema-agnostic governance space for whatever project it is installed into. It keeps a weekly
copy of your tables, tells you which rows have aged past a window **you** set, and reports where
personal data appears to live.

**It never deletes anything.** There is no delete on the agent surface, and it never writes a
host-app row at all — its `db:write` grant names three tables and only three. A retention report
NAMES candidates; you remove them in your own app, with your own eyes on the list.

## Own tables (created idempotently at bind)

| Table | Purpose |
|---|---|
| `archive_policies` | One per host table: `targetTable`, `snapshotEnabled`, `retentionColumn`, `keepDays`, `status` (`active`\|`proposed`\|`disabled`), `createdAt` |
| `archive_snapshots` | `targetTable`, `takenAt` (`YYYY-MM-DD`), `rowCount`, `dataJson` (the whole table, stable-serialized), `snapshotKey`, `createdAt` |
| `archive_reports` | `kind` (`retention`\|`pii`), `targetTable`, `detailJson`, `reportKey`, `status` (`open`), `createdAt` |

## Actions

- **`bind`** (tasklist): inventory the schema → propose one policy per table → create the own
  tables and persist, deduped on `targetTable`. Every policy lands as `proposed`, snapshots ON,
  **retention deliberately unset** — see below.
- **`snapshot`** (tasklist): Sunday-gated (UTC). Loads active policies with snapshots enabled and
  writes one stable-JSON `archive_snapshots` row per table per day. Triggered daily at 05:30 by
  `hooks/weekly-snapshot.ts`; the weekly cadence is the gate inside the tasklist, not the schedule.
- **`retention-scan`** (tasklist): for policies that have a `retentionColumn` AND `keepDays > 0`,
  lists rows strictly older than the window (calendar days, UTC — the boundary day is still kept)
  as one `retention` report per table per day.
- **`pii-scan`** (tasklist): samples up to 50 rows per table and reports which columns hold
  `email`, `phone`, `iban` or `card` shapes — **counts only, never the matched values**.
- **`review`** (prose, live session): activate policies, set the retention column and keep window
  with the user, walk open reports.

## Retention is never proposed automatically

`bind` gives every table `{ snapshotEnabled: true, retentionColumn: '', keepDays: 0 }`. A schema
cannot tell `orders.created_at` (keep for years) from `sessions.created_at` (noise) — only the
person who owns the data can. A missing policy is an inconvenience; a wrong one produces a
confident list of records to delete. So retention waits for a human in `review`, and
`retention-scan` skips every unconfigured policy. Snapshots default on because a snapshot only ever
adds a copy.

## Size honesty

`dataJson` holds the **entire table** as JSON, so a big table makes a big row — every Sunday. Turn
snapshots off for high-volume tables before activating their policy. `dataJson` is never truncated:
a partial snapshot is worse than none, because it looks complete.

## Events other spaces can consume (queue-table convention)

Every recorded report is an insert into `archive_reports`, auto-emitting the synthetic event
**`project/db.archive_reports.insert`** (payload = the report row); snapshots likewise emit
**`project/db.archive_snapshots.insert`**. Subscribe from a project hook or from
`utility-dispatcher` — no custom event machinery required.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `buildTableSnapshot` (inlined stable
stringify — sorted keys, arrays in order, cycles as `"[cycle]"`, so an unchanged table produces a
byte-identical snapshot), `scanPiiInRows` (four shapes, Luhn-gated cards, counts only),
`findRetentionCandidates` (calendar-day math with an injected `now`, boundary exclusive),
`computeArchiveKey` (day-truncated identity → one snapshot/report per table per day). Tasklist
nodes are role- and capability-narrowed per step; the only nodes with `db:write` are the three that
insert a row into an `archive_*` table.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
