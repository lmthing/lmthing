# The import flow — eight steps, two gates

1. Obtain the source text (untrusted data).
2. Parse it; report row count, delimiter, ragged/skipped counts.
3. **GATE — the user names the target table.** Never inferred.
4. Propose the column mapping; the user corrects it.
5. Agree the natural key for dedupe.
6. **GATE — dry run.** Clean / issue / duplicate counts plus up to 10 concrete issue examples. The
   user says go or stop.
7. Insert approved rows only, skipping duplicates by key.
8. Record one `import_jobs` row with the exact counts, then report.

## Why two gates and not one

The two gates guard different mistakes. Step 3 catches *wrong destination* — the single most
expensive error, because a hundred rows in the wrong table are indistinguishable from real data a
week later. Step 6 catches *wrong shape* — a mapping that looked right but drops half the values,
which only becomes visible when you count what would land.

Neither is a formality. The importer cannot undo anything: there is no delete on the agent surface,
and inserted rows carry no import marker. The dry run IS the undo.

## Dedupe

`computeImportRowKey(targetTable, row, keyColumns)` normalizes each key value (trim, lowercase,
collapse whitespace), so re-importing an updated export inserts only the genuinely new rows. The key
is computed against the COERCED row so it matches what was actually stored.

Existing rows are keyed the same way before the run, which is what makes a repeated import cheap
and safe rather than a duplicate storm.

## Issues are reported, never fixed

A cell that fails its type hint is omitted and recorded in `issues`. The importer never rounds,
never substitutes a default, never "cleans" a value into place. If a whole column is failing, that
is a mapping or hint problem for the user to correct — not something to paper over row by row.
