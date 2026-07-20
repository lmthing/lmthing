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

---

## L3 DESIGN (2026-07-20): host-enforced destructive-write interlock

### What it is — and what it is NOT

Move the destructive-write GUARD out of model prose into HOST code. It is an **interlock on the delete**,
NOT a smarter diagnostician. Be precise about scope, because two things it does not do are load-bearing:

- It does **not** decide what is wrong. Diagnosing the culprit from a free-text complaint stays
  `01-diagnose` (a model) — genuinely a language/judgment task, unchanged.
- It does **not** make diagnosis correct. If diagnose names a plausible-but-wrong row, the interlock
  cannot know the domain intent; its only lever is "does removing this verifiably achieve the effect
  diagnose CLAIMED?"
- It **guarantees** the one thing prose cannot: **no hard delete proceeds unless the host can VERIFY,
  from the live rows, that it achieves diagnose's own stated justification.** Unverifiable ⇒ refuse +
  surface the existing `question` (ask path). Fail-safe: never destroy on doubt.

**Residual it does NOT solve (explicit):** a wrong culprit whose removal *coincidentally* lands the
figure on the asserted target — e.g. two rows of equal value, the real duplicate vs a legit twin. That
is irreducible ambiguity and belongs to the ask path (diagnose `confidence: low`), not the interlock.
**The confirm-before-write step below is what covers this residual** (the human sees the exact proposed
delete and can veto it) — the interlock alone cannot.

### Confirm before destructive writes — the fix is PROPOSED, not auto-applied (directive 2026-07-20)

Revises the auto-apply default. When diagnose finds a culprit and a destructive action (a `remove`, or
an overwrite that loses a stored value), the tasklist must NOT apply it silently — it INFORMS the user
what it found and the exact action it proposes, and writes only after the user confirms. This overrides
the current "when the correct value is CERTAIN, apply and re-read — do NOT stop to ask permission" stance
(`instruct.md:528-529`) for the destructive path.

Flow — uses the EXISTING return-question + re-invoke machinery (a tasklist node CANNOT call `ask()`
itself; `ask`/`fork`/`tasklist` are not in a fork's capability profile, per CLAUDE.md):

1. `01-diagnose` (model) finds culprit + action + `figureSpec`/`assertedTarget`.
2. **Code pre-filter** (the mode-(a)/(b) verify below): if the action would NOT change the figure toward
   the asserted target — run-32: removing the EUR row leaves the USD sum unchanged — the tasklist returns
   "already correct, nothing to change" and proposes NOTHING. This is what keeps a WRONG proposal off the
   user's screen entirely.
3. Otherwise the tasklist RETURNS `{ applied:false, proposedAction:<summary>, question:"I found <cause>;
   I plan to <action> — OK to proceed?" }`. THING relays the question. Nothing is written yet.
4. On the user's YES, THING RE-INVOKES `resolve_flagged_figure` with the approved decision as STRUCTURED
   input (`decision: { table, targetIds, fixAction, ... }`), NOT a fresh free-text complaint. Diagnose is
   skipped / runs verify-only; the `03-fix` code node executes the pre-decided, code-verified mutation.

Step 4's structured carry IS this issue's fix-direction point 1 ("accept a caller-provided decision —
verify-and-report only, do NOT re-diagnose"). The original run-32 bug was diagnose RE-LITIGATING an
already-decided complaint on re-invoke; carrying the decision structurally removes that vector. **The
confirm loop and the re-invocation-safety fix are one mechanism.**

The code interlock does NOT disappear — it takes two jobs: **(a) pre-proposal filter** (never propose a
destructive no-op) and **(b) execution guard** (re-verify at apply time; state may have moved between
propose and confirm). Division of labour: human confirmation catches the semantic residual code cannot
(the equal-value culprit); code catches the mechanical no-op the human should not be bothered with.

**Consequences to land in the SAME change (behavior change ⇒ doc/scenario change):**
- `instruct.md:528-529` prose ("do NOT stop to ask permission for a repair you can state precisely") must
  be amended for the destructive path → "state the repair precisely, then ASK before applying it."
- Scenario `06-tanzania` step 9 `expect` currently asserts "it investigates the actual rows and FIXES the
  number in the DB." Under confirm-first this is a two-turn exchange (propose+ask, then apply on "yes");
  the step (and a confirming `say`) must be updated so the judge scores the new contract. The scenario is
  the source-of-truth for the expected UX — changing behavior REQUIRES changing the step.

**Open scope (pending user decision before build):** confirm-first applies to — (a) EVERY fix in this
tasklist; (b) only destructive `remove`s (auto-apply a reversible corrective `update`); or (c) a HYBRID —
auto-apply only when the code VERIFIES the action hits the asserted target EXACTLY, ask in every other
case (preserves the happy-path auto-fix AND still catches the equal-value residual). The directive as
stated = (a)/(b); (c) preserves the most product value. Not yet decided.

### Two verification modes — mirror diagnose's own confidence contract

`01-diagnose` already returns `high` only under one of two justifications (01-diagnose.md:38-49). The
interlock enforces each IN CODE:

- **(a) target-selected** (user stated the figure should be X; one candidate reproduces it): recompute
  the figure WITHOUT `targetIds`; delete only if `before != after` **and** `after == assertedTarget`
  (within tolerance). This kills the run-32 case — already-correct total, removing the EUR row leaves the
  USD sum unchanged (`before == after`) ⇒ refuse.
- **(b) structural duplicate** (provable: same row/charge counted twice, no stated target): delete only
  if each `targetId` has a genuine identical PEER row that diagnose points at (`duplicateOf`), verified
  equal on the figure column ⇒ removing a proven duplicate is always safe.
- **neither code-verifiable ⇒ refuse**, return `{applied:false}`, relay `question` (ask the user).

### Non-overfit rule (this is a user-thing space — NO domain literals)

The figure's identity flows in as DATA from diagnose; the code carries no `sum`/`amount`/`costs`/`USD`
literal.

- diagnose emits a generic recompute descriptor `figureSpec: { op, column, filter } | null`, where
  `op ∈ {sum,count,avg,min,max}` — a generic aggregate grammar, driven entirely by data.
- Figures NOT expressible as a single-table aggregate (a cross-table roll-up, an app-endpoint
  derivation): `figureSpec: null` ⇒ the code cannot recompute ⇒ **fail-safe refuse ⇒ ask**. No data
  loss. The scenario's intended happy path (a single-table double-count inside `costs`) IS expressible,
  so it still auto-fixes; only exotic figures downgrade to ask — strictly safer than today's stochastic
  auto-delete.
- STRONGER genericity — recompute via the app's OWN derivation (the endpoint step 8 reads) instead of
  re-deriving the aggregate — is possible but needs **trial-delete + rollback**, and `AsyncDbApi` has no
  transaction (store.ts): rollback = capture the rows first, delete, re-insert on failure (restoring ids
  + relations exactly). Real cost; DEFER unless the aggregate grammar proves too narrow in practice.

### Implementation seam (verified 2026-07-20)

Convert `02-fix.md` (a `role:general` model fork) → `02-fix.ts`, the **first shipped `kind:'code'` node**
in any system space.

- **Node module contract** (`sdk/org/libs/cli/src/app/worker-load.ts:156-183`):
  `export async function run(ctx, inputs)` — no default export. `ctx.db` is the project's async db proxy
  (query/tables/insert/update/remove — `DB_METHODS`, mirrors `AsyncDbApi`), serviced main-process-side;
  `inputs` carries the upstream `diagnose` output. Worker-isolated, timeout-bounded.
- **Metadata** is AST-extracted from a top-level `const node = { id:'fix', kind:'code',
  dependsOn:['diagnose'], condition:"diagnose.confidence == 'high'", output:{...} }` — the loader NEVER
  imports/executes the module (`sdk/org/libs/core/src/spaces/tasklist-load.ts:16,75,100`).
- **Host execution is already wired for THING's own tasklists**:
  `SessionManager.buildCodeNodeCtxFactory` (session-manager.ts:541) → `createCodeNodeCtxFactory`
  (tasklist-runner.ts:91), threaded at session-manager.ts:526-528 (in-session) and :2146-2159
  (headless). `getDb()` yields the live project async db. **No new plumbing.**
- **`01-diagnose` output gains** `figureSpec {op,column,filter}|null`, `assertedTarget string|null`,
  `duplicateOf array|null`. Its confidence rule (01-diagnose.md:36-54) already COMPUTES the
  justification; it must now EMIT the machine-checkable evidence for it.
- **db layer unchanged**: `db.remove` → hard SQL DELETE (`sdk/org/libs/cli/src/app/store.ts:454`); the
  interlock lives ABOVE db, in the node (it needs the figure + target context db does not have). The
  scoped `remove` chokepoint (`app-globals.ts:156`) is the wrong layer — it sees only `(table, opts)`.

### `run(ctx, inputs)` logic (pseudocode)

```
const d = inputs.diagnose;   // {fixAction, table, targetIds, assertedTarget, figureSpec, duplicateOf, targetValue}
if (d.fixAction === 'none') return { applied:false, changed:0, detail:'already correct' };

if (d.fixAction === 'remove') {
  const rows = await ctx.db.query(d.table, d.figureSpec?.filter ?? {});
  if (d.assertedTarget != null && d.figureSpec) {            // mode (a): target-selected
    const before = agg(d.figureSpec.op, rows, d.figureSpec.column);
    const kept   = rows.filter(r => !d.targetIds.includes(String(r.id)));
    const after  = agg(d.figureSpec.op, kept, d.figureSpec.column);
    if (before === after)                    return { applied:false, detail:'target rows are not part of the figure — refused' };
    if (!approxEq(after, d.assertedTarget))  return { applied:false, detail:`removing gives ${after}, not the asserted ${d.assertedTarget} — refused` };
  } else if (d.duplicateOf?.length) {                        // mode (b): structural duplicate
    for (const [i,id] of d.targetIds.entries())
      if (!isDuplicatePeer(rows, id, d.duplicateOf[i], d.figureSpec?.column))
        return { applied:false, detail:'not a verifiable duplicate — refused' };
  } else return { applied:false, detail:'no code-verifiable justification for a delete — refused (ask the user)' };

  for (const id of d.targetIds) await ctx.db.remove(d.table, { where: { id } });
  return { applied:true, changed:d.targetIds.length, before, after, detail:`removed ${d.targetIds.length} row(s) from ${d.table}` };
}

if (d.fixAction === 'update') { /* same verify: recompute with the field set to targetValue; apply only if after == assertedTarget */ }
```

`agg` / `approxEq` / `isDuplicatePeer` are generic local helpers (no domain literals).

### Generalizes to the destructive-write class

The same interlock — *"a destructive delete must code-verify it achieves its asserted effect, or it does
not happen"* — folds in the siblings this issue already names: `retract_fact` row-grain and
`derived-balance-delete-vs-resolve`. Soft-delete / exclude-from-total (point 3 above) is the complementary
hardening for obligation/identity rows where even a verified delete loses history.

### Oracle + verification plan

- `resolve-already-correct` (committed, RED 4/8) proves mode-(a) fail-safe: already-correct total; delete
  changes nothing ⇒ refuse. GREEN when the code node refuses. Primary gate.
- ADD two repros:
  - **mode-(a) success**: seed a genuine single-table double-count; assert the DUPLICATE row is removed
    and the total lands on target.
  - **equal-value hazard**: seed a real overage where a legit row equals the overage; assert NO delete
    (routes to ask), guarding the residual case above.
- Gates: three repros GREEN + 06 step-9 happy path still fixes a real double-count + anti-overfit scan
  clean (no domain literal in `02-fix.ts`) + typecheck / spaces DAG / scenarios green.

### Risks / must-check before shipping

- **First shipped code node in a system space** — the loader (`tasklist-load.ts`) and worker-load path
  exist but no system tasklist uses `kind:'code'` yet. Verify end-to-end from a BUILT image (not just
  vitest-from-src): the `.ts` code node must transpile + execute in the worker, and its
  `worker-load-entry` tsup entry must be present (CLAUDE.md "adding a worker-run seam ⇒ add its tsup
  entry").
- **`inputs` shape** — confirm the orchestrator passes `{diagnose}` (dependency outputs keyed by id) plus
  the seed `complaint` to `run(ctx, inputs)`; adjust the destructuring to the real shape.
- **`condition` on a code node** — `02-fix` keeps `condition:"diagnose.confidence=='high'"`; confirm the
  orchestrator evaluates a code node's `condition` identically to an agent node's.

### Fix-ladder placement

L3 (host code) — L1/L2 prose is proven insufficient (the reverted two-layer guard came back RED 6/8,
worse than the 4/8 baseline). This is the lowest rung that reliably holds.
