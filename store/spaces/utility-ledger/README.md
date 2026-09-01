# utility-ledger — the money overlay

A schema-agnostic space that finds the **(amount, date, category)** column sets in whatever project
it is installed into, binds them, and closes each calendar month into a `ledger_reports` row —
totals, per-category breakdown, and an over-budget flag when you set a monthly limit.

It hardcodes **no table or column names** from the host app. Binding is discovery-driven: the
`bind` tasklist introspects `db.tables()`, samples real rows, classifies money columns with a pure
function (name signal + numeric parse rate), picks the best sibling date and category columns, and
persists binding rows — high-confidence ones as `active`, the rest as `proposed` for you to confirm
via the bookkeeper's `review` action.

It is an **overlay, not a bookkeeping system**: it never edits a host-app row. A report row
*represents* a period; if the numbers look wrong, the fix is in the source rows (edited by whoever
owns them) and a re-close — never a doctored report.

## Own tables (created idempotently at bind)

| Table | Purpose |
|---|---|
| `ledger_bindings` | One row per bound column set: `targetTable`, `amountColumn`, `dateColumn`, `categoryColumn`, `direction` (`expense`\|`income`\|`unknown`), `status` (`active`\|`proposed`\|`disabled`), `confidence`, `createdAt` |
| `ledger_budgets` | Optional monthly limit per binding: `bindingId`, `monthlyLimit`, `createdAt` |
| `ledger_reports` | The queue: `bindingId`, `periodStart`, `periodEnd`, `total`, `count`, `byCategoryJson`, `overBudget`, `reportKey`, `status` (`open`), `createdAt` |

## Events other spaces can consume (queue-table convention)

Every closed period is an insert into `ledger_reports`, which auto-emits the synthetic event
**`project/db.ledger_reports.insert`** (payload = the report row). Subscribe to that from a project
hook or from `utility-dispatcher` to get "the month closed, here are the numbers, and here is
whether it went over budget" — no custom event machinery required.

## Agent

`bookkeeper` — actions:

- **`bind`** (tasklist, host-driven): inventory schema → classify money columns → persist bindings.
  Safe to re-run; an existing (targetTable, amountColumn) pair is never duplicated.
- **`close`** (tasklist, host-driven): gate on "is it the 1st?" → load active bindings and budgets →
  summarize the previous calendar month per binding → record deduped `ledger_reports` rows.
  Triggered daily at 07:30 by `hooks/monthly-close.ts`; the tasklist's own gate step makes every
  day but the 1st a no-op. Idempotent (dedupe on `reportKey`).
- **`budgets`** (prose, live session): set or change a binding's `monthlyLimit`.
- **`review`** (prose, live session): activate/disable proposed bindings and walk the reports.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `discoverAmountColumns` (money-column
classification plus sibling date/category selection), `summarizePeriod` (locale-tolerant amount
parsing and `[start, end)` calendar-day filtering), `previousMonthRange` (UTC month math with an
injected `now`), `computeReportKey` (stable report identity). Tasklist nodes are role- and
capability-narrowed per step; the only write nodes are the ones that need `db:write`.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
