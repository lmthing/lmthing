# resolve_flagged_figure destructively deletes a correct row when NO fix was needed (data loss)

**Symptom** (06-tanzania run 32 step 9, 2026-07-20 — SEVERE, data loss not just a wrong ask):
this run's build did NOT have the historical double-count bug — the dashboard already correctly
showed $3,344.20 at step 8 (USD-only sum; the €2,707 flights row tracked separately by design). So
step 9's scripted complaint ("total doesn't match, should be ~3344") described a bug that did not
exist this run. THING correctly diagnosed the USD rows already sum to $3,344.20, posed a RadioGroup
ask ("how to handle the EUR flights row?", default keep), the ask went UNMATCHED (no if_asked entry
this run), THING correctly inferred "keep as-is," and re-invoked `resolve_flagged_figure` with an
explicit instruction embedded in the `complaint` string: "keep the total as-is … the EUR 2,707
flights row is tracked separately and should NOT be added … do not double-count them."

**Despite that explicit "do NOT touch it,"** the `diagnose` node re-diagnosed from scratch against
the raw complaint prose, set `fixAction:'remove'` targeting the EUR flights row, and the fix node
executed `db.remove(...)`. Result: `costs` 16→15, the real `flights|EUR|2707.0` row GONE from app.db
(sqlite before/after). The reply falsely framed the destruction as the fix: "The EUR flights row has
been removed … 13 USD rows now sum cleanly to $3,344.20 — exactly your spreadsheet target."

**Attribution:** `libs/core/system-spaces/user-thing/tasklists/resolve_flagged_figure/{01-diagnose.md,
02-fix.md}`. The `01-diagnose` node (role:explore, cheap model) re-derives cause + `fixAction` purely
from the free-text `complaint` every time it's called — there is no channel for a caller that has
ALREADY resolved the ambiguity (via its own ask/reasoning) to say "the decision is made, just
verify+report, do NOT re-litigate or act." `02-fix.md` then executes destructively once
`confidence=='high'` ("do NOT re-litigate whether to act"). The cheap explore model keyed off "EUR
2,707 flights row" being named prominently and chose `remove` regardless of the surrounding "should
NOT" language.

**Same destructive-write reliability class as:**
- `retract_fact` row-grain (06 step 15) — scrapping one item collateral-deleted whole rows (fixed in eb67ebb; repro `retract-fact-row-grain`).
- `derived-balance-delete-vs-resolve` — hard-deleting a balance-due line zeroed a genuine outstanding balance.

All three: a user-thing destructive-write tasklist deletes more/other than intended. Worth a single
hardening pass across resolve_flagged_figure (and a cross-check of retract_fact).

**Fix direction (L2, user-thing — no domain literals):**
1. `resolve_flagged_figure` must accept a caller-provided "decision already made — verify-and-report
   only, do NOT re-diagnose or act" mode (or a structured target/decision), so a caller that resolved
   the ambiguity is not overridden by a fresh free-text re-diagnosis.
2. The fix node must not DESTRUCTIVELY delete a row that the diagnosis shows is *correct/unrelated* —
   "the flagged total is already right" is a valid diagnosis whose action is NONE, distinct from
   "a row is wrong, remove it." A "keep as-is" resolution must never delete data.
3. Prefer mark-resolved/exclude-from-total over hard delete for obligation/identity rows (folds in
   derived-balance).

**Verify (cheaply reproducible — `db count` collateral guard):** seed a state whose displayed total
is ALREADY correct; fire the "total doesn't match, should be <the-already-correct-value>" complaint;
assert NO costs row is deleted (`db costs count == <baseline>`) and no data-loss reply. This is the
same repro shape as `retract-fact-row-grain` and is a good next repro target.

**Evidence:** scenarios/06-tanzania/runs/32/step-09.json (asks[0]: matched:null, answer:"";
state.appTables.costs 15 vs step-08's 16) + step-09.full.json; sessions.log:56860-57010; DB proof
`sqlite3 …/tanzania-trip-2026/.data/app.db "SELECT * FROM costs"` (no flights row, 15 total).
Pre-bug snapshot: scenarios/06-tanzania/runs/32/snapshots/step-08/.

---

## Repro committed + prose-guard attempt FAILED (2026-07-20): needs L3 code enforcement

Reliable repro committed: **`sdk/org/scenarios/repros/resolve-already-correct/`** (seed from 06 run 32
step-08; trigger insistently claims the already-correct total is wrong and names the EUR flights row as
a plausible-but-wrong culprit; asserts `db costs count == 16` + the EUR row id still exists). Sharpened
to a reliable **RED 4/8**.

A two-layer PROSE fix was tried (reverted): `01-diagnose.md` gained an explicit "already correct →
fixAction:'none'" outcome, and `02-fix.md` gained a "deterministic" guard — before any `db.remove`,
recompute the figure with/without the target rows and abort if excluding them doesn't change it. Static
gates all passed (typecheck, spaces 205/205, scenarios, anti-overfit clean), but the repro came back
**RED 6/8 — WORSE/no-better than the 4/8 baseline.** Root cause of the failure: the "deterministic"
guard is still PROSE the cheap fix-node model must choose to execute, and it skips the recompute-check
stochastically, deleting the row anyway. **Reverted** (not green; 6/8 ≥ 4/8 is not a safe partial).

**Conclusion — needs L3 CODE enforcement, not prose.** The reliable fix is a host-side guard on the
fix node's destructive write: e.g. `resolve_flagged_figure`'s `db.remove` path (or the `db.remove`
capability when invoked from this tasklist) verifies IN CODE that the target row actually participates
in the flagged figure before deleting, and refuses otherwise — so the guarantee doesn't depend on the
model executing prose. Same class as `thing-no-new-specialist-space-mid-conversation.md` (stochastic
THING execution that prose can't reliably fix). The `resolve-already-correct` repro is the ready oracle
for that L3 fix.
