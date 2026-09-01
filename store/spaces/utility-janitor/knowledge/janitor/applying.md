# Applying — the propose-then-apply contract

`apply` is the only pass that touches host-app data, and it is deliberately narrow.

## The three hard rules

1. **Only `approved` rows.** `apply` loads `db.query('janitor_findings', { where: { status:
   'approved' } })` and nothing else. A `proposed` finding is invisible to it — approval is a human
   act, and skipping that act is the one failure mode that matters.
2. **The patch, exactly as recorded.** `JSON.parse(patchJson)` gives a `{column: value}` object;
   it is passed verbatim to `db.update(targetTable, { where: { id: rowId }, set: patch })`. No
   extra columns, no re-derived values, no "obvious" adjacent fix.
3. **Nothing is ever deleted.** There is no delete on the agent surface. A `duplicate` finding has
   an empty `patchJson` on purpose: which row survives is a human decision. The janitor may at most
   apply a merge patch to the surviving row — recorded and approved like any other patch.

## Per-finding outcomes

| situation | result |
|---|---|
| `patchJson` parses to an object | `db.update(...)` → `{ applied: true }` |
| `patchJson` is malformed JSON | `{ applied: false, reason: 'bad-patch' }` — never guess what was meant |
| `patchJson` is `''` | `{ applied: false, reason: 'no-patch finding — resolution is a human decision' }` |

A failing branch never sinks the run (per-item nodes are `optional: true`) and never changes the
finding's status — an unapplied finding stays `approved` and shows up again next time.

## After the update

Only branches that reported `applied: true` move to `status: 'applied'`. Status is the audit trail:
`applied` means "this exact patch reached the row". Never mark a finding `applied` on optimism.
