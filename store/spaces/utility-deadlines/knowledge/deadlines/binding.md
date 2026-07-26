# Binding — how watchers come to exist

A watcher is one row in `deadline_watchers`: `{ targetTable, targetColumn, labelColumn, leadDays,
status, confidence, createdAt }`. Binding never edits the host app — it only observes schema and
samples, then persists watcher rows.

## Confidence → status

`discoverDateColumns` scores each (table, column) candidate from a name signal and a value
parse-rate. Persist policy:

- `confidence >= 0.8` → `status: 'active'` — safe to sweep immediately.
- `0.3 <= confidence < 0.8` → `status: 'proposed'` — waits for the user's `review`.
- below → not persisted at all.

## Default lead windows (deterministic, by column semantics)

| Column name matches | leadDays |
|---|---|
| `expir…`, `valid_…`, `renew…` | 30 |
| `due…`, `deadline`, `until` | 14 |
| `start…`, `end…`, `date…`/`…date`, `…_on` | 7 |
| anything else | 14 |

## Label column

Pick the first of `name`, `title`, `label` present in the table's sampled keys; otherwise leave
`labelColumn` empty (the sweep falls back to the row id). Never guess a column that wasn't seen.

## Idempotency

A (targetTable, targetColumn) pair that already has ANY watcher row — whatever its status — is
skipped on re-bind. Re-binding never resurrects a watcher the user set to `disabled`.
