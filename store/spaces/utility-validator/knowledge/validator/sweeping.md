# Sweeping — how violations open and close

One check pass: load `status: 'active'` rules grouped BY TABLE → per table, load its rows once (and
the referenced tables' ids for any `reference` rule) → evaluate every rule against every row with
`checkRule` → record new violations and auto-resolve the fixed ones.

## The dedupe contract

`computeViolationKey(ruleId, targetTable, rowId)` is the identity: the same rule failing the same
row is the SAME violation, forever. Check-before-insert is mandatory — query
`validation_violations` filtered by the key first, insert only when empty. So re-running a sweep on
unchanged data inserts nothing, which is why the daily cron is free.

## Auto-resolution — and its one precondition

After recording, any **open** violation whose `violationKey` was NOT produced this sweep moves to
`status: 'resolved'` — the rule ran, the row passed, the problem is gone.

The precondition is absolute: **only for tables that were actually scanned this sweep.** A branch
that failed, a table that no longer exists, a rule that got disabled — none of those are evidence
that data was fixed. Each scan branch reports `scanned: boolean`; violations belonging to a table
that was not scanned stay exactly as they are. Silently closing a violation you did not re-check is
the worst thing this space could do.

## What a check never does

- Never writes a host-app table.
- Never activates, disables or edits a rule — that is a `review` decision.
- Never sets `ignored` — that is a human decision. The sweep only ever sets `open` (new) and
  `resolved` (re-checked and passing).
- Never re-opens an `ignored` violation.
- Never turns a `skipped` result into a violation (see `validator/rules`).

## Failure honesty

The report states three numbers from the upstream steps only: `recorded`, `autoResolved`,
`stillOpen`. If a table could not be scanned, say so rather than implying its violations were
verified.
