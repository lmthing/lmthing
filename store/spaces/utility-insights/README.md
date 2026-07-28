# utility-insights — ask my data, and a weekly digest

A schema-agnostic space that profiles whatever tables the host project happens to have, answers
data questions live from the actual rows, and — once a week — records a digest of the shape of your
data as a row in `insight_reports`.

It hardcodes **no table or column names** from the host app. Every number it reports comes out of a
pure function run over rows it actually read: `profileTables` (fill / numeric / date rates per
column), `summarizeNumericColumn` (count, min, max, mean, median, sum), `detectOutliers` (1.5×IQR),
`formatReportMarkdown` (deterministic rendering). The analyst never estimates.

## Own tables (created idempotently by the digest's record step)

| Table | Purpose |
|---|---|
| `insight_reports` | The queue: `period` (ISO week, e.g. `2026-W31`), `generatedAt`, `summary`, `highlightsJson`, `dedupeKey` (`week:<period>`), `status` (`open`), `createdAt` |

## Events other spaces can consume (queue-table convention)

Every recorded digest is an insert into `insight_reports`, which auto-emits the synthetic event
**`project/db.insight_reports.insert`** (payload = the report row). Subscribe to that from a project
hook or from `utility-dispatcher` — no custom event machinery required.

## Agent

`analyst` — actions:

- **`digest`** (tasklist, host-driven): gate → inventory → per-table analysis → compose → record →
  report. `hooks/weekly-digest.ts` fires the action **daily** at 08:00; the first step is a gate
  that only lets the run proceed on Mondays (UTC), so the digest is effectively weekly without
  needing a weekly cron primitive. Idempotent: the report row dedupes on `week:<isoWeek>`.
- **`ask`** (prose, live session): answer a data question by querying the real tables and computing
  with the pure functions — citing actual rows, never estimating.

## Determinism

All judgment-free logic lives in pure, unit-tested functions in `functions/`; each file is
self-contained (no cross-imports — space functions are injected standalone). Tasklist nodes are
role- and capability-narrowed per step; the only node with `db:write` is `05-record`.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
