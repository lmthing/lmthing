# utility-janitor — the data janitor

A schema-agnostic space that inspects whatever project it is installed into for three concrete
data-quality problems — **duplicates**, **normalizable values** and **orphan rows** — and queues
each one as a proposal in `janitor_findings`. Nothing in the host app changes until a human
approves the exact patch.

It hardcodes **no table or column names**. The `scan` tasklist introspects `db.tables()`, samples
real rows, and runs pure detectors per table; foreign keys and natural keys are inferred from the
schema it finds, never assumed.

## Own tables (created idempotently at scan)

| Table | Purpose |
|---|---|
| `janitor_findings` | The queue: `targetTable`, `rowId`, `kind` (`duplicate`\|`normalize`\|`orphan`), `detail`, `patchJson` (the exact `{column: value}` object to apply, or `''` for non-patch findings), `findingKey`, `status` (`proposed`\|`approved`\|`rejected`\|`applied`), `createdAt` |

## Events other spaces can consume (queue-table convention)

Every recorded finding is an insert into `janitor_findings`, which auto-emits the synthetic event
**`project/db.janitor_findings.insert`** (payload = the finding row). Subscribe to that from a
project hook or from `utility-dispatcher` — no custom event machinery required.

## Agent

`janitor` — actions:

- **`scan`** (tasklist, host-driven): inventory schema + samples → detect per table → record
  `proposed` findings. Triggered daily at 06:00 by `hooks/daily-scan.ts`; idempotent (dedupe on
  `findingKey`), so a daily run on unchanged data records nothing.
- **`apply`** (tasklist, host-driven): load **`approved`** findings only → apply each recorded
  patch verbatim → mark the successful ones `applied`.
- **`review`** (prose, live session): walk `proposed` findings with the user; approve or reject.
  Status updates only — no host-app write happens here.

## The propose-then-apply guarantee

- `apply` **never** touches a `proposed` finding — approval is a human act and cannot be skipped.
- The janitor **never deletes**: there is no delete on its surface. Duplicate resolution is a human
  decision; the most the janitor may do is propose a merge patch on the surviving row.
- Patches apply **exactly as recorded** — `JSON.parse(patchJson)` straight into `db.update`, no
  improvisation, no adjacent "while I'm here" fixes.

## Determinism

All judgment-free logic lives in pure, unit-tested functions: `findDuplicateGroups` (normalized
grouping), `normalizeCellValue` (whitespace/email/phone/date, refusing anything it cannot prove),
`findOrphanRows` (set membership, no I/O), `computeFindingKey` (stable finding identity). Tasklist
nodes are role- and capability-narrowed per step; only the record/apply/mark nodes hold `db:write`.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
