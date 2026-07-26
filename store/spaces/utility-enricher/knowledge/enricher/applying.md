# Applying — the approve gate and the conflict rule

`apply` is the only action in this space that writes a host-app table. Three rules govern it, and
each one is enforced structurally, not by good intentions.

## 1. The approve gate

`apply`'s first step loads `db.query('enrich_tasks', { where: { status: 'approved' } })` — and only
that status. `pending`, `proposed`, `not-found` and `rejected` are invisible to it.

Only a human moves a task to `approved`, in the enricher's `review` action, after seeing the value
**and** its `sourceUrl` on the same line. No tasklist ever sets `approved`; `research` sets
`proposed` or `not-found`, `apply` sets `applied`. A fork cannot `ask()`, which is precisely why
the propose-then-apply split exists: the pass that computes a value is never the pass that writes
it.

## 2. Re-validation (defense in depth)

Every approved value is re-run through `validateProposedValue` immediately before the write. The
proposal may be days old, the column may have been retyped, and the review UI shows a string. A
value that no longer validates resolves `{ applied: false, reason: 'revalidation failed: …' }` and
stays approved with the reason attached — visible in the next review, never silently dropped.

The value written to the database is `check.normalized`, not the raw stored string: numbers land as
numbers, dates as `YYYY-MM-DD`.

## 3. The no-longer-empty conflict rule

Before writing, `apply` re-reads the target row and checks the target column:

- the row is gone → `{ applied: false, reason: 'row-missing' }`
- the column now holds anything non-blank → `{ applied: false, reason: 'no-longer-empty' }`
- otherwise → `db.update(targetTable, { where: { id: rowId }, set: { [column]: normalized } })`

**A human's value always wins.** The enricher fills blanks; it does not correct, improve or replace
what someone already typed. A `no-longer-empty` result is the guardrail working correctly, and the
report says so rather than treating it as a failure.

## Blast radius

One `set` key, one row, one table, per approved task. Never a second column ("while I'm here"),
never a batch update by a non-id filter, never a delete — there is no delete on the agent surface,
and "undo" for an applied value is the user editing their own row.
