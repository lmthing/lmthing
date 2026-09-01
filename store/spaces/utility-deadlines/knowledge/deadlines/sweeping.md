# Sweeping — how alerts come to exist

One sweep pass: load `status: 'active'` watchers → for each, load its table's rows and run
`computeDueItems(rows, column, leadDays, nowIso, labelColumn)` → insert one `deadline_alerts` row
per due item **whose `dedupeKey` does not already exist**.

## The dedupe contract

`makeDedupeKey(table, rowId, column, dueAt)` keys on the DATE (not time). Consequences:

- Re-running a sweep (same day or any later day, unchanged data) inserts nothing new.
- A deadline that MOVES (the cell's date changes) produces a new alert — that's correct; the old
  one stays until dismissed or done.
- Check-before-insert is mandatory: query `deadline_alerts` filtered by the key first
  (`db.query('deadline_alerts', { where: { dedupeKey: key } })`), insert only when empty.

## What a sweep never does

- Never writes any host-app table.
- Never dismisses/completes alerts — only `review` (a human decision) changes alert status.
- Never invents a due date: an unparseable cell is skipped, and skipping is not an error.
- Never notifies: delivery belongs to consumers of `project/db.deadline_alerts.insert`.

## Failure honesty

A watcher whose table no longer exists (schema drifted since bind) is reported in the sweep
summary as `staleWatchers` — it is NOT disabled automatically; that's a `review` decision.
