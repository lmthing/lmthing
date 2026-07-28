# utility-validator — the data-contract inspector

A schema-agnostic space that turns the implicit expectations in whatever project it is installed
into — this column is always filled, that one only ever holds three values, this id always points
somewhere real — into explicit **rules**, then checks them every morning and queues every failure
in `validation_violations`.

It hardcodes **no table or column names**. Binding is discovery-driven: the `bind` tasklist
introspects `db.tables()`, samples real rows, and derives conservative, evidence-backed rules with
a pure function. Every suggested rule lands as `proposed` — **rules become `active` only through
human review**.

## Own tables (created idempotently at bind)

| Table | Purpose |
|---|---|
| `validation_rules` | One row per contract: `targetTable`, `column`, `kind` (`required`\|`range`\|`regex`\|`enum`\|`reference`), `configJson`, `status` (`active`\|`proposed`\|`disabled`), `createdAt` |
| `validation_violations` | The queue: `ruleId`, `targetTable`, `rowId`, `reason`, `violationKey`, `status` (`open`\|`resolved`\|`ignored`), `createdAt` |

## Events other spaces can consume (queue-table convention)

Every recorded violation is an insert into `validation_violations`, which auto-emits the synthetic
event **`project/db.validation_violations.insert`** (payload = the violation row). Subscribe to that
from a project hook or from `utility-dispatcher` — no custom event machinery required.

## Agent

`inspector` — actions:

- **`bind`** (tasklist, host-driven): inventory schema + samples → suggest rules → persist them all
  as `proposed`. Safe to re-run; dedupes on (targetTable, column, kind) and never resurrects a
  disabled rule.
- **`check`** (tasklist, host-driven): load active rules by table → evaluate every rule × row →
  record deduped violations and auto-resolve the ones the data has fixed. Triggered daily at 06:30
  by `hooks/daily-check.ts`; idempotent (dedupe on `violationKey`).
- **`review`** (prose, live session): activate/disable rules, ignore violations, and add
  hand-written rules — each tested against a real row with `checkRule` before it is inserted.

## Two guarantees worth stating

- **An unrunnable rule never creates a violation.** An invalid regex returns
  `{ ok: true, skipped: 'invalid-pattern' }`, not a failure — a broken rule is not a broken row.
- **A violation auto-resolves only for a table that was actually scanned this sweep.** Not scanning
  something is never evidence that it was fixed.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `checkRule` (five kinds, no I/O,
skip-not-fail semantics), `suggestRules` (evidence thresholds, 50%-widened ranges, deterministic
ordering), `computeViolationKey` (stable violation identity). Tasklist nodes are role- and
capability-narrowed per step; only the persist/record nodes hold `db:write`.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
