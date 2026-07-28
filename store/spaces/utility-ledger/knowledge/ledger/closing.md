# Closing — how report rows come to exist

One close pass, on the 1st of the month: resolve the previous calendar month with
`previousMonthRange(nowIso)` → load `status: 'active'` bindings and all budgets → for each binding
run `summarizePeriod(rows, amountColumn, dateColumn, categoryColumn, periodStart, periodEnd)` →
insert one `ledger_reports` row per binding **whose `reportKey` does not already exist**.

## Period semantics

The range is **half-open, UTC, calendar-day**: `[periodStart, periodEnd)`. `periodStart` is the 1st
of the previous month, `periodEnd` is the 1st of the current month and is EXCLUSIVE — so a row
dated the 1st of the current month belongs to the NEXT close, never to two reports. Times of day
are irrelevant: a value is placed by its UTC calendar day, so a `23:30` local-evening timestamp
does not drift into a neighbouring month depending on where the pod runs.

A row whose date cell does not parse is skipped. Skipping is not an error and is not a licence to
guess a date.

## Undated bindings

A binding with `dateColumn: null` has no period at all. `summarizePeriod` then includes EVERY row
and returns `undated: true`. Consequences to state plainly whenever such a report is shown:

- the total is a running total of the whole table, not "last month";
- it grows every month, and comparing two such reports compares two snapshots, not two periods;
- the over-budget flag on an undated binding means "the whole table exceeds the limit", which is
  rarely what a monthly budget means.

That is why an undated binding lands as `proposed` at bind time and needs a human to activate it.

## The dedupe contract

`computeReportKey(bindingId, periodStart)` keys on the binding and the period start DATE.
Consequences:

- Re-running a close for the same month (retried cron, manual re-run) inserts nothing new.
- A different month is a different key — exactly one report row per binding per period.
- Check-before-insert is mandatory: query `ledger_reports` filtered by the key first
  (`db.query('ledger_reports', { where: { reportKey: key } })`), insert only when empty.

## Over budget

`overBudget` is true when a `ledger_budgets` row exists for the binding AND the period `total`
exceeds its `monthlyLimit`. No budget row means `overBudget: false` — an absent limit is not a
limit of zero. A limit set after a report was written does not retro-flag it.

## What a close never does

- **Never writes any host-app table.** A report row REPRESENTS the period; it does not define it.
  If a total looks wrong, the source rows are wrong — and fixing rows to make a number come out is
  falsification, not bookkeeping. Report the discrepancy; leave the rows to their owner.
- Never adjusts a computed total, count or category split "to make it look right".
- Never invents a category: an empty or missing category cell buckets as `uncategorized`.
- Never changes a report's status — that's a human decision in `review`.
- Never notifies: delivery belongs to consumers of `project/db.ledger_reports.insert`.

## The queue-table convention

`ledger_reports` IS this space's outbound interface. Every insert auto-emits the synthetic event
`project/db.ledger_reports.insert` with the report row as payload — that emission is the consumer
signal. A project hook or `utility-dispatcher` subscribes to it to send the monthly summary or
escalate an over-budget month. Nothing here sends anything itself, and no custom event machinery is
needed.

## Failure honesty

A binding whose table no longer exists (schema drifted since bind) is reported in the close summary
as a stale binding — it is NOT disabled automatically; that's a `review` decision.
