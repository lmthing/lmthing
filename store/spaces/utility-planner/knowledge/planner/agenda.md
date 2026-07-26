# Agenda — how the day-by-day view is built

One agenda pass: load `status: 'active'` bindings → load each bound table's rows once → run
`buildAgendaEntries(bindings, rowsByTable, fromIso, days)` → `groupEntriesByDay(entries)` → present.
Nothing is written; the agenda is a read-only view.

## The window

Calendar days in UTC, **half-open**: `[from's day, from's day + days)`. Consequences:

- A midday call still shows everything happening today — a date column means a day, not an instant.
- 14 days from a Monday covers that Monday through the second Sunday; the 15th day is excluded.
- `days` defaults to 14 when it is missing or not positive. Ask the user for a different range; never
  widen the window on your own "to find something".

## Ordering and grouping

`buildAgendaEntries` sorts by `date`, then `table`, then `rowId`. `groupEntriesByDay` preserves that
order exactly — days appear in the order their first entry appears, entries keep their order within a
day. Days with no entries are absent; the agenda never pads itself with empty dates.

## What an agenda never does

- Never writes any host-app table — the only writable table is `planner_bindings`, and only to change
  a binding's `status`.
- Never reschedules: a date is changed in the app that owns it, not here.
- Never invents an entry. A row whose bound column is empty or unparseable is skipped, and skipping
  is not an error. A row without an `id` is skipped too — an entry nobody can navigate back to is
  not useful.
- Never shows `proposed` bindings' rows. Mention how many proposals exist and offer, via `ask()`, to
  activate them.

## Failure honesty

A binding whose table no longer exists simply contributes no rows — report the empty range plainly
rather than hiding it, and say how many bindings and how many days the view covered.
