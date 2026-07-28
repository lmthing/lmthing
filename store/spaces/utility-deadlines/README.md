# utility-deadlines — the date watcher

A schema-agnostic space that discovers date/datetime columns in whatever project it is installed
into, lets you arm **watchers** ("warn me 14 days before anything in `documents.expiry_date`"), and
runs a daily **sweep** that records approaching deadlines as rows in `deadline_alerts`.

It hardcodes **no table or column names** from the host app. Binding is discovery-driven: the
`bind` tasklist introspects `db.tables()`, samples real rows, classifies date-like columns with a
pure function, and persists watcher rows — high-confidence candidates as `active`, the rest as
`proposed` for you to confirm via the keeper's `review` action.

## Own tables (created idempotently at bind)

| Table | Purpose |
|---|---|
| `deadline_watchers` | One row per (table, column) being watched: `targetTable`, `targetColumn`, `labelColumn`, `leadDays`, `status` (`active`\|`proposed`\|`disabled`), `confidence`, `createdAt` |
| `deadline_alerts` | The queue: `watcherId`, `targetTable`, `rowId`, `dueAt`, `daysLeft`, `label`, `dedupeKey`, `status` (`open`\|`dismissed`\|`done`), `createdAt` |

## Events other spaces can consume (queue-table convention)

Every recorded alert is an insert into `deadline_alerts`, which auto-emits the synthetic event
**`project/db.deadline_alerts.insert`** (payload = the alert row). Subscribe to that from a project
hook or from `utility-dispatcher` — no custom event machinery required.

## Agent

`keeper` — actions:

- **`bind`** (tasklist, host-driven): inventory schema → classify date columns → persist watchers.
  Safe to re-run; existing (table, column) watchers are never duplicated.
- **`sweep`** (tasklist, host-driven): load active watchers → scan each table → record deduped
  alerts. Triggered daily at 07:00 by `hooks/daily-sweep.ts`; idempotent (dedupe on
  `table:rowId:column:dueDate`).
- **`review`** (prose, live session): walk `proposed` watchers and `open` alerts with the user;
  activate/disable watchers, dismiss/complete alerts.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `parseDateValue` (lenient date
parsing), `discoverDateColumns` (name + value-parse-rate classification), `computeDueItems`
(window math with an injected `now`), `makeDedupeKey` (stable alert identity). Tasklist nodes are
role- and capability-narrowed per step; the only write node is the one that needs `db:write`.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
