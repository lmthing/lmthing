# utility-auditor — the change log

A schema-agnostic space that snapshots whatever tables it is bound to and, once a day, diffs the
current rows against the last snapshot into an **append-only** `audit_log`: what was added, what
changed (column by column, with the exact before/after values), and what was removed.

It hardcodes **no table or column names** from the host app: `bind` lists `db.tables()` and
proposes a binding for every table that isn't part of the utility spaces' own bookkeeping.

## Draft-only reverts

The auditor holds **no write access to any host table** — deliberately. Its `revert-draft` action
writes out the exact `db` statements that would restore a logged `beforeJson`, in a fenced code
block, for a human to run. It cannot execute them, and it says so. A change log that can quietly
rewrite the thing it is logging is not a change log.

## Own tables (created idempotently at bind)

| Table | Purpose |
|---|---|
| `audit_bindings` | One row per audited table: `targetTable`, `status` (`active`\|`proposed`\|`disabled`), `createdAt` |
| `audit_snapshots` | Last known state, one row per audited row: `targetTable`, `rowId`, `rowJson`, `rowHash`, `updatedAt`. A removed row is TOMBSTONED (`rowJson: ''`, `rowHash: 'removed'`), never deleted — the agent surface has no delete |
| `audit_log` | The queue, append-only: `targetTable`, `rowId`, `change` (`added`\|`changed`\|`removed`), `beforeJson`, `afterJson`, `changedColumnsJson`, `changeKey`, `sweepAt`, `createdAt` |

## Events other spaces can consume (queue-table convention)

Every recorded change is an insert into `audit_log`, which auto-emits the synthetic event
**`project/db.audit_log.insert`** (payload = the log row). Subscribe to that from a project hook or
from `utility-dispatcher` to alert on changes to something sensitive — no custom event machinery
required.

## Agent

`auditor` — actions:

- **`bind`** (tasklist, host-driven): list the host tables → persist a `proposed` binding per
  eligible table. Safe to re-run; a table already bound is never duplicated.
- **`sweep`** (tasklist, host-driven): load active bindings → diff current rows against
  `audit_snapshots` → append `audit_log` entries and re-snapshot. The FIRST sweep of a table is a
  baseline: it seeds snapshots and logs nothing (an empty log is not "everything was added
  today"). Triggered daily at 05:45 by `hooks/daily-sweep.ts`; idempotent (dedupe on `changeKey`,
  which is keyed to the sweep DAY).
- **`report`** (prose, live session): "what changed since X", grouped by table and day.
- **`revert-draft`** (prose, live session): draft — never run — the statements that would undo one
  logged change.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `stableStringify` (canonical
serialization — the substrate of every comparison), `hashRow` (content hash), `diffRows`
(column-level diff over the key union), `computeChangeKey` (stable, day-truncated log identity).
Tasklist nodes are role- and capability-narrowed per step; the only write node is the one that
needs `db:write`.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
