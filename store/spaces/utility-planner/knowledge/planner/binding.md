# Binding — how the planner learns where the dates live

A binding is one row in `planner_bindings`: `{ targetTable, targetColumn, labelColumn, kind, status,
confidence, createdAt }`. Binding never edits the host app — it only observes schema and samples,
then persists binding rows.

## Confidence → status

`discoverScheduleColumns` scores each (table, column) candidate from a name signal (0.5) and a value
parse-rate (0.5). Persist policy:

- `confidence >= 0.8` → `status: 'active'` — it feeds the agenda immediately.
- `0.3 <= confidence < 0.8` → `status: 'proposed'` — invisible to the agenda until the user
  activates it in a live session.
- below → not persisted at all.

## Kind (by column name, deterministic)

| Column name matches | kind |
|---|---|
| `start…` | `range-start` |
| `end…`, `…until` | `range-end` |
| `due…`, `deadline`, `expir…` | `deadline` |
| anything else | `event` |

Matching is done on the snake_cased name, so `startsAt` and `start_date` classify identically. Order
matters — `start` wins over `end`, `end`/`until` win over `due`/`deadline`/`expir` — so a column
named `end_of_due_period` is a `range-end`. The agent never overrides a computed `kind`.

Unlike a deadline watcher, `start`/`end` columns are **kept**: a planner wants the whole range, not
just the due date. Bookkeeping columns (`createdAt`, `updated_at`, `deletedAt`, `insertedAt`,
`modifiedAt`) are still excluded — they timestamp record-keeping, not plans — and `planner_bindings`
itself is never bound.

## Label column

Pick the first of `name`, `title`, `label` present in the table's sampled keys; otherwise leave
`labelColumn` empty (the agenda falls back to `name`/`title`/`label` on the row, then the row id).
Never guess a column that wasn't seen.

## Idempotency

A (targetTable, targetColumn) pair that already has ANY binding row — whatever its status — is
skipped on re-bind. Re-binding never resurrects a binding the user set to `disabled`.
