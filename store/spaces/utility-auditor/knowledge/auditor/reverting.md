# Reverting — a draft, never an execution

The auditor can describe exactly how to undo a logged change. It cannot perform it, and it must
say so every time it offers one.

## The contract

`revert-draft` produces a fenced code block containing the `db` statements that would restore an
entry's `beforeJson`, addressed to the user. That is the entire deliverable. There is no follow-up
step where the auditor runs it "if you confirm" — confirmation changes nothing, because the
capability isn't there to grant.

## Why the auditor holds no host-table write access

Its `db:write` grant names `audit_bindings`, `audit_snapshots` and `audit_log` and nothing else, so
a write to any host table does not even typecheck in its context. Three reasons, in order of
weight:

1. **A log that can rewrite what it logs is not evidence.** The value of the audit trail comes
   entirely from the auditor being a witness, not a participant. Once it can edit the tables it
   observes, every entry becomes "either this happened, or the auditor did it" — and no report
   built on the log can distinguish the two.
2. **A revert is a judgement, not a computation.** The log knows what a row looked like; it does
   not know whether the change was a mistake, a correction, or the whole point of the day's work.
   Restoring `beforeJson` may undo something a human did on purpose an hour ago, or clobber three
   subsequent edits that built on it. The person who owns the data decides that.
3. **Reverts are exactly the operation you cannot safely automate on a cron.** The sweep runs
   unattended. An unattended actor with both "detect anomaly" and "restore previous state" is one
   bad heuristic away from silently reverting real work every morning.

Withholding the capability — rather than instructing the agent not to use it — is the enforcement.
Prose does not stop a tool call; an absent grant does.

## Drafting honestly

- `changed` → `db.update('<table>', { where: { id: <rowId> }, set: { <the before values> } })`.
  Restore only the columns in `changedColumnsJson`; a blanket overwrite of the whole row would also
  revert columns that changed for unrelated reasons afterwards.
- `removed` → `db.insert('<table>', { <the before row> })`. Warn that the id will probably be
  reassigned: the restored row is a new row that looks like the old one, and anything referencing
  the old id will not follow it.
- `added` → there is no hard delete on the agent surface. The honest options are a status update,
  or a direct database operation outside the agent surface entirely. Say which; do not imply the
  agent can make the row cease to exist.
- Always name the staleness risk: the draft reflects the row as it was at that sweep. If it changed
  again since, running the draft reverts those later changes too. Show the user the entries that
  came after, so the decision is informed.

## After a revert

If the user runs the draft, the next sweep sees the difference and logs it as an ordinary change —
attributed to the day it actually happened. The audit trail records the revert as an event in its
own right. Nothing is back-dated, nothing is erased, and the log never claims a change did not
happen.
