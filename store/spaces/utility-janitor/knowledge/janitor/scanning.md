# Scanning — how findings come to exist

One scan pass: inventory every host table with sampled rows → per table, run the three detectors →
record each result as a `janitor_findings` row with `status: 'proposed'`.

## The three kinds

| kind | detector | `detail` | `patchJson` |
|---|---|---|---|
| `duplicate` | `findDuplicateGroups(rows, keyColumns)` | the normalized group key + the sibling row ids | `''` — resolution is a human decision |
| `normalize` | `normalizeCellValue(kind, value)` per string cell | the column name | `JSON.stringify({ [column]: normalizedValue })` |
| `orphan` | `findOrphanRows(rows, fkColumn, parentIds)` | `<fkColumn>=<value>` and the parent table | `''` — deleting or re-pointing is a human decision |

## Choosing what to look at (deterministic, not intuition)

- **Natural key for duplicates**: the FIRST of `email`, `name`, `title`, `label` that the table
  actually has. No such column → no duplicate detection for that table. Never invent a key.
- **Normalization candidates**: every string column, per row. Ask `normalizeCellValue` with the
  kind implied by the column (`email`-ish name → `email`, `phone`/`tel`/`mobile` → `phone`,
  date-ish name → `date`, otherwise `whitespace`) and record a finding **only where `changed` is
  true**. The function refuses to normalize anything it cannot prove — trust that refusal.
- **Foreign keys**: columns named `<name>_id` or `<name>Id` where a table matching `<name>`
  (singular or plural) exists. Load that table's ids with `db.query` and pass them in. No matching
  table → not a foreign key, skip it.

## Idempotency

`computeFindingKey(targetTable, rowId, kind, detail)` is the identity. Check-before-insert on
`findingKey` is mandatory: query `janitor_findings` filtered by the key first, insert only when
empty. This is why the daily cron is free — unchanged data produces zero new rows.

## What a scan never does

- Never writes a host-app table. Not one column. Findings are proposals.
- Never sets a status other than `proposed`.
- Never scans `janitor_findings` itself (no self-inspection loop).
- Never reports a "problem" a function did not return — no eyeballed typos, no guessed duplicates.
