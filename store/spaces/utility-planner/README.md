# utility-planner — one agenda across every table

A schema-agnostic space that discovers the date columns scattered across whatever project it is
installed into, records them as **bindings**, and renders a single day-by-day agenda out of all of
them at once — trips, invoices, appointments and shifts in one list.

It hardcodes **no table or column names** from the host app. Binding is discovery-driven: the `bind`
tasklist introspects `db.tables()`, samples real rows, classifies date-like columns with a pure
function (also assigning each a `kind`), and persists binding rows — high-confidence candidates as
`active`, the rest as `proposed` for you to confirm in a live session.

## On-demand by design — no hooks

This space ships **no `hooks/` directory**. An agenda is something you ask for; there is nothing to
sweep, no queue to fill, and nothing to notify. Every run is user-initiated (`bind` once, `agenda`
whenever you want to look), which is why there is no cron and no background writing.

## Own tables (created idempotently at bind)

| Table | Purpose |
|---|---|
| `planner_bindings` | One row per (table, column) feeding the agenda: `targetTable`, `targetColumn`, `labelColumn`, `kind` (`event`\|`deadline`\|`range-start`\|`range-end`), `status` (`active`\|`proposed`\|`disabled`), `confidence`, `createdAt` |

## Agent

`scheduler` — actions:

- **`bind`** (tasklist, host-driven): inventory schema → classify date columns and their kind →
  persist bindings. Safe to re-run; existing (targetTable, targetColumn) pairs are never duplicated.
- **`agenda`** (prose, live session): load the active bindings, read their tables, build the entries
  for the next 14 days (or whatever range you ask for) and present them grouped by day.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `discoverScheduleColumns` (name +
value-parse-rate classification, plus `kind`), `buildAgendaEntries` (calendar-day window math with
an injected `from`), `groupEntriesByDay` (grouping that preserves the computed order). Each file is
self-contained (no cross-imports — space functions are injected standalone). Tasklist nodes are
role- and capability-narrowed per step; the only write node is `03-persist`.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
