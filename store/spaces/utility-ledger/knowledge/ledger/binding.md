# Binding — how money column sets come to exist

A binding is one row in `ledger_bindings`: `{ targetTable, amountColumn, dateColumn,
categoryColumn, direction, status, confidence, createdAt }`. Binding never edits the host app — it
only observes schema and samples, then persists binding rows.

## What counts as an amount column

`discoverAmountColumns` requires BOTH signals:

- **name**: matches `/(amount|price|cost|total|fee|paid|balance|spend|expense|income|budget)/i`;
- **values**: at least **0.8** of the non-empty sampled values parse as numbers (locale-tolerant —
  see `ledger/closing`). A table with no sampled rows at all keeps the name signal but scores low.

## What is excluded, and why

`/(^id$|_id$|count|qty|quantity|year|month|day)/i` never binds, plus the bookkeeping timestamps
(`createdAt`, `updatedAt`, …). These are the columns that look numeric and sum cleanly while
meaning nothing:

- `id` / `*_id` are identities. Summing them produces a number that changes when rows are
  renumbered — a total with no referent.
- `count`, `qty`, `quantity` are multiplicities, not money. `total_qty` would otherwise slip in via
  the `total` hint; the exclusion wins over the hint deliberately.
- `year`, `month`, `day` are calendar parts. Summing 12 rows of `month` yields 78, which is a
  perfectly stable, perfectly meaningless number.

The exclusion list is checked AFTER the name hint and always overrides it. When in doubt, a column
is better left unbound: the user can bind it explicitly in `review`.

## Direction

Read off the amount column's own name — the semantics live in the name, not in the numbers:

| Column name matches | direction |
|---|---|
| `cost`, `fee`, `paid`, `spend`, `expense` | `expense` |
| `income`, `revenue` | `income` |
| anything else (`amount`, `total`, `price`, `balance`, `budget`) | `unknown` |

`unknown` is an honest answer, not a failure. Nothing in `close` depends on direction; it exists so
reports can be read the right way round by a human or a consumer.

## Sibling columns

- **dateColumn**: the best date-like column in the SAME table, classified by name hint plus value
  parse rate (bookkeeping timestamps excluded — a `createdAt` records when a row was typed, not
  when the money moved). May be `null`.
- **categoryColumn**: the first column matching `/(category|type|kind|tag)/i` whose sampled values
  are strings. May be `null` — then everything buckets as `uncategorized`.

## Confidence → status

`confidence = 0.5 + 0.4 * numericRate + (dateColumn ? 0.1 : -0.2)`, clamped to [0, 1]. Persist
policy:

- `confidence >= 0.8` → `status: 'active'` — safe to close on immediately.
- `0.3 <= confidence < 0.8` → `status: 'proposed'` — waits for the user's `review`.
- below → not persisted at all.

The `-0.2` for a missing date column is the whole point of the penalty: a dateless binding sums
EVERY row on every close (see `ledger/closing`), which is a decision a human should make, not a
classifier.

## Idempotency

A (targetTable, amountColumn) pair that already has ANY binding row — whatever its status — is
skipped on re-bind. Re-binding never resurrects a binding the user set to `disabled`.
