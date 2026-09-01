# Digesting — how the weekly report comes to exist

One digest pass: gate on the day → inventory the schema with up to 50 sampled rows per table →
profile each table (fan-out, one branch per table) → compose from those numbers only → record one
`insight_reports` row.

## The gate is what makes it weekly

The cron primitive is **daily** (`hooks/weekly-digest.ts`, 08:00). `01-gate` resolves
`shouldRun = new Date().getUTCDay() === 1` — Monday, UTC — and every downstream step except the goal
node is `condition: "gate.shouldRun == true"`. Six mornings out of seven the run costs one episode
and stops. The goal node deliberately has no condition so that every firing still reports something.

## The period identity

`weekLabel` is the ISO-8601 week (`YYYY-Www`): the week's Thursday decides the year, week 1 contains
4 January. It is computed once, in the gate, and threaded down — never recomputed later, so every
step of one run agrees on which week it is.

## The dedupe contract

`dedupeKey = week:<weekLabel>`, checked before insert
(`db.query('insight_reports', { where: { dedupeKey } })`, insert only when empty). Consequences:

- A retry, a second cron firing, or a manual re-run on the same Monday writes nothing.
- Exactly one report row per ISO week, forever.

## What goes into the report

Only what a function returned:

| Figure | Source |
|---|---|
| row counts, per-column fill / numeric / date rates | `profileTables` |
| count, min, max, mean, median, sum | `summarizeNumericColumn` |
| outlier counts (1.5×IQR) | `detectOutliers` |
| the markdown itself | `formatReportMarkdown` |

A column is summarized when `numericRate >= 0.6` and it is not `id`. `summarizeNumericColumn`
returning `count: 0` means "not a numeric column" — that column simply contributes no highlight.

## What a digest never does

- Never writes any host-app table — the only write is `insight_reports`.
- Never compares against a previous period. There is no trend machinery; a "% up since last week"
  would be invented.
- Never fills an empty week with prose: `formatReportMarkdown` returns `''` and the row records that
  quiet week honestly.
- Never notifies: delivery belongs to consumers of `project/db.insight_reports.insert`.

## Failure honesty

A table that cannot be read fails only its own `optional` branch; the digest continues and the
remaining tables are reported. If `record` produced no result at all, the goal node reports
`ok: false` — it never claims a row that was not written.
