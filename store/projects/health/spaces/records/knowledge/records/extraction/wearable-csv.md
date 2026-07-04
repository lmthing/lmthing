# Wearable CSV export

## The shape

`parseCsv` expects (and the wearable export format assumes) four columns in this order:

```
kind,value,unit,recordedAt
weight,72.4,kg,2026-06-30T07:00:00Z
sleep_hours,7.2,h,2026-06-30T06:00:00Z
steps,8421,count,2026-06-30T23:59:00Z
```

A first line containing the word "kind" is treated as a header and skipped; every other line is
data. Rows that don't coerce cleanly (missing `kind`, non-numeric `value`) are silently dropped by
`parseCsv` rather than inserted half-formed — trust the parser's judgment on what counts as a
usable row rather than trying to rescue a malformed line by hand.

## Common metric kinds

The `metrics` table is intentionally generic (no per-metric-type schema), so the `kind` string is
what gives each row meaning. The wearable exports the analyst sees most often carry:

- `weight` (kg or lb)
- `sleep_hours` (h)
- `steps` (count)
- `resting_hr` (bpm)
- `bp_systolic` / `bp_diastolic` (mmHg) — a wearable export sometimes reports these as two separate
  rows rather than one combined reading; keep them separate, matching the schema.

Preserve whatever `kind`/`unit` the export actually uses rather than renaming or unit-converting —
the app's job is to store what was measured, not to normalize units across devices.

## Dedupe on kind + recordedAt

A user may re-upload the same export (or an overlapping date range from a second sync). Before
inserting a parsed row, check whether a `metrics` row with the same `kind` and `recordedAt` already
exists, and skip the insert if so — this keeps a re-analysis of the same file, or an overlapping
export, from doubling up the same reading rather than adding a genuinely new one.
