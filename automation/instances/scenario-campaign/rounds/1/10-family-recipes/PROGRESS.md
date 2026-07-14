# PROGRESS — scenario-campaign · task `10-family-recipes` · round 1

_Started 2026-07-14T07:25:23.012Z. The agent MUST update this file at every step._

## Steps

- **Orient.** Read `scenario.md` (fully authored, 6 sections + 12 Acts + Edges). `run.mjs` does NOT
  exist → round-1 job is to implement it 1:1 from the Acts table. Harness read end-to-end.
- **Fixture audit (before writing a single assertion).** Verified every fixture is real: `recipe.pdf`
  extracts selectable text (Easy Lasagna / Cooking with Extension Cookbook pg. 22 / 12 oz. cottage
  cheese / slow cooker Low ~6 hours); `pantry-and-plan.xlsx` is a real 3-sheet workbook
  (Pantry/MealPlan/ShoppingList, inline-string cells, 20 PNT rows + 2 weeks of plan + a merged
  shopping list); `voice-memo.mp3` is real MPEG audio (24 kHz mono, ~36 s); both jpgs are real photos
  (viewed them: the card IS a handwritten "Orange Cake" w/ crisco + 1 cup raisins + Angel food cake
  tin + 400° for 40 min; the dish photo IS a moussaka slice + Greek salad + bulgur/tabbouleh + chopped
  parsley); all 3 `links.md` URLs return **200**.
- **Found a spec↔fixture contradiction (Act II).** `scenario.md` asserts `Σπανακόπιτα`/`Spanakopita`
  occurs in **no** fixture but the audio, and lists `750`/`320` as audio-unique. **All three are false
  against the committed workbook**: the MealPlan sheet schedules `Σπανακόπιτα`/`Spanakopita` on
  Saturday, and the ShoppingList sheet carries `Σπανάκι 750 g` + `Φέτα ΠΟΠ 320 g`. Ran a disjointness
  grep across all fixtures. The genuinely audio-only tokens are: **μαστίχα · τσίπουρο · Δέσποινα ·
  Λευκάδα · πράσο · άνηθο · "αυγό στη γέμιση"** (and `190`/`55`, which appear nowhere at all — the
  memo says them in words). Corrected Act II + the §8 fixtures table to assert on those instead: the
  dish *name* proves nothing (it's in the spreadsheet), the **recipe** is what only the ear can hear.
  This makes the Act *stronger*, not looser — a token that also sits in the xlsx made the audio
  assertion worthless.

- **Baseline run #1 (11:54, Act I only) → FAIL, 21/26.** Four real failures, all triaged against the
  trace + the live pod's on-disk project:
  1. **THING AUTHORED during the ingest turn.** Turn 1 delegated to `system-architect/.../
     synthesize_and_run` twice — it built the two cuisine spaces *before* Vasilis ever said yes. That
     breaks US-1 (the offer turn must author nothing) and is why turn 1 took **951 s** against a 5-min
     ceiling.
  2. **The offer assertion failed** — with the build already done, the reply reported rather than asked.
  3. **The app was EMPTY — the anti-expectation itself.** 4 tables (meal_plan/pantry/recipes/
     shopping_list) with real rows, and **zero pages, zero api routes** on disk (`pages/` holds only
     `_layout.tsx`). `built:true` + `routes:0`; `/app/family-recipes/` served a 479-byte shell. Data in
     a drawer.
  4. **6 unrecovered typecheck errors** (e.g. `Variable 'functions' implicitly has an 'any[]' type` in
     the architect).
- **Triage verdict: 1–3 were fixed by SIBLING lanes after my run started; do not re-fix.** My run
  (11:54) predates `2d145c2` (14:35, user-thing: *"GATE — before ANY authoring delegate, did they
  ASK?"* — exactly failures 1+2) and `3ceb32c` (14:51, system-appbuilder: *"the empty-app failure —
  make the app OPENABLE EARLY"* — failure 3). Checked `f4cb7ae` (uploads: scanned PDF → vision) for a
  conflict with **Act III**: none — `readDocument` *still* returns `{ok:false, kind:'unsupported',
  error:/system-vision/}` for an image (`libs/cli/src/server/uploads.ts`, asserted in
  `uploads.test.ts:342`), so Act III's guard assertion stands.
- **Next: rebuild + restart + re-run Act I on a WIPED project** (Act I asserts "no spaces exist
  before the dump", so it needs a virgin `family-recipes`) to see which failures survive the siblings'
  fixes and which are mine to own.

## Files added to context

- `sdk/org/scenarios/10-family-recipes/scenario.md` — the spec I must implement 1:1.
- `sdk/org/scenarios/10-family-recipes/run.mjs` — the runner a previous attempt of THIS round wrote
  (978 lines, Acts I–XII + Edges); confirmed 1:1 with the Acts table.
- `sdk/org/scenarios/10-family-recipes/results/report.md` — the failing baseline I am triaging.
- `sdk/org/scenarios/harness/probe-automator-pages.mjs` — a sibling lane's minimal repro of the
  empty-app bug (automator returns tables, zero pages); the evidence it was already owned + fixed.
- `git show 2d145c2 / 3ceb32c / f4cb7ae` — the three sibling commits that land between my baseline run
  and now; the first two fix three of my four failures.
- `libs/cli/src/server/uploads.ts` + `uploads.test.ts` — the `readDocument` image guard Act III asserts.
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs` + `provision.mjs` — the harness API (Pod
  routes, ThingSession turn/trace projection, Report).
- `sdk/org/scenarios/09-home-renovation/run.mjs` — the most recent complete runner; the model for the
  hardening patterns (checkpoint/resume, keepalive, resilient send, scripted onAsk, unrec()).
- `sdk/org/scenarios/10-family-recipes/fixtures/*` — every fixture, inspected for real (pdftotext,
  xlsx XML dump, `file`, both images viewed, links curl'd) to ground the assertions.
</content>

## Session 3 (2026-07-14, resumed)

- **Rebuilt core+cli and restarted the local server** to pick up the sibling lanes' typecheck/eval
  rebinding fixes (`2479438`, `0229f29`) — those target exactly my Act I blocker (the 2 unrecovered
  `Cannot assign to 'functions' because it is a constant` errors).
- **Ran Acts II + III live** against the existing Act I build (never run before).
  - **Act II → 14/16.** The core proof HOLDS: the mp3 upload response carries a real Whisper
    transcript pre-turn; all 6 audio-only tokens are disjoint across fixtures; the `recipes` row for
    the dish carries **4** audio-only tokens (μαστίχα, τσίπουρο, πράσο, άνηθο) plus `190°C`/`55 λεπτά`
    — which the memo speaks *as words*, so they exist as digits in no fixture at all. Audio → Whisper
    → real row is proved.
  - **Two failures, and they are a REAL product bug, not a loose assertion:** `Δέσποινα` and
    `Λευκάδα` never reached state. The memo says *"Το μυστικό της Θείας Δέσποινας από τη Λευκάδα"*;
    the builder recorded the secret (μαστίχα) and threw away **who it came from**. It even chose a
    `source` column — and filled it with `"Ηχητικό μήνυμα της μάνας"`, i.e. the CHANNEL the material
    arrived on, not the name the material states. The user's own words were *"βοήθησέ με να μη χαθεί
    τίποτα"*.
  - **Act III → 17/21.** `readDocument` was never called on the image at all (`resolutions: []`), so
    the host guard was never exercised. Cause: the runner opened the probe as **THING**, which is
    smart enough to route an image straight to vision — good product behaviour, but it means the Act
    tests nothing. `scenario.md` §6 specifies `agentSlug:'system-files/dispatch'`. **Runner bug**
    (not 1:1 with the spec).
- **Fixed both + committed (`e127990`).**
  - Product: `system-appbuilder/automator/instruct.md` — new general principle *"Keep the ATTRIBUTION
    the material carries — who it came from, where it originated"*, with the near-miss guard (*"the
    transport is not the attribution"* — a `source` field filled with "from an attachment" looks done
    and is not). **Zero scenario literals** — stated abstractly; the existing anti-overfit guard in
    `prompt-contract.test.ts` scans for scenario strings and passes.
  - Test: `libs/core/src/spaces/prompt-contract.test.ts` — a regression guard that would have caught
    the absence of both the principle and the near-miss warning. 3/3 green.
  - Runner: Act III's probe now runs as `system-files/dispatch` per the spec.
- **Now: fresh baseline re-run of Acts I–III** on a wiped project, so the attribution fix is exercised
  at SEED time (Act I is what seeds) and the sibling typecheck fix is confirmed.

## Files added to context (this session)

- `sdk/org/scenarios/10-family-recipes/results/{report.md,checkpoint.json,trace.json}` — the prior
  attempt's Act I baseline (24/26) I resumed from.
- `sdk/org/scenarios/10-family-recipes/run.mjs` (Acts II–VII read in full) — to triage II/III.
- `sdk/org/scenarios/harness/lib/thing.mjs` — confirmed `attempt >= MAX_RETRIES` really means "the
  turn loop gave up", so the unrecovered-error check is a genuine product signal, not an artifact.
- `libs/core/src/sandbox/trace.ts` + `eval/turn-loop.ts:629` — confirmed `yield_resolved{kind,value}`
  is a real event type, so Act III/V's resolved-value assertions are structurally sound.
- `libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md` — the seeding brain; where
  the attribution fix landed.
- `libs/core/src/spaces/prompt-contract.test.ts` — the existing home for load-bearing prompt
  assertions + the anti-overfit scanner; where my regression test landed.
- The live `recipes` row for the dish (via the app data API) — the evidence for the attribution bug.

### Goal 2 — the three NEW Acts (committed `116c3c5`)

Chosen from the coverage audit's never-exercised list, each extending the same persona's story:

- **Act XIII — gap M (history summarization past `maxHistoryTurns`).** Vasilis states a house rule
  ONCE, in passing, never saying "remember this" (so `user-memory`, Act IX's path, is NOT what is
  under test). ~16 turns of ordinary kitchen chatter then push the session past `maxTurns*2`
  messages and the runtime collapses the old turns into a **deterministic digest** (no `streamFn` is
  passed — `summarize.ts` keeps user task lines + VARIABLES + errors, and DROPS every assistant
  reply). Asserted on the **persisted session file** + a **CONTROL** that the rule's turn is gone
  from the verbatim tail (without it a pass proves nothing), and finally on **a real row**: the dish
  it puts on Sunday must have no garlic in its `recipes` row.
- **Act XIV — gap L (`db.query`'s `include` over a declared relation).** Asserts a declared
  `belongsTo`/`hasMany` in the on-disk schema, `include` in the **route's own source** (so a
  hand-rolled second query can't pass), and the route returning the recipe **nested** — cross-checked
  against the **audio-only tokens**, so the join is proved against data only the memo could supply.
- **Act XV — gap L (capability gating AT TYPECHECK).** The security model's load-bearing claim, which
  **no scenario has ever asserted**: not granted ⇒ absent from the DTS ⇒ the call fails **typecheck**
  rather than throwing at runtime. Probes the cuisine agent directly, asserts it wasn't over-granted
  `db:write` on disk, and asserts the **failure mode**, not merely that no write happened.

### Baseline re-run (wiped project, rebuilt core) — TWO NEW REAL BUGS IN THING'S BRAIN

Act I re-run cleanly on the ingest gate (authored nothing before the yes ✓, cited every fixture ✓),
but **turn 1 failed the OFFER check** — and reading the trace showed why, twice over:

1. **THING dumped its own plumbing at the user.** The turn's final display was a `KeyValue` panel:
   `"seenImages type":"string"`, `"fileResults length":"11304"`. **It had been taught to** — THING's
   `instruct.md` contained **EIGHT** `display(JSON.stringify(<raw return>, null, 2))` /
   `display(seen)` examples. The campaign doc's warning ("an example in an agent's brain gets copied
   into real output") is exactly what happened, verbatim.
2. **THING reported instead of OFFERING.** It summarised the material beautifully and stopped — no
   question. The sibling lane's authoring GATE (`2d145c2`) correctly withholds the *build* until the
   user agrees, but nothing told THING to still **ask**. A user who doesn't know an app is an option
   is left with nothing to say yes to, and the turn dies.

**Fixed + committed (`2b96f53`) — ⚠️ this touches THING's SHARED triage brain, flagged loudly:**
all eight dump examples now read the value and speak to the user; a general principle *"Never show
them your plumbing"* (the test: *would this line mean anything to someone who has never seen the
code?*); and *"a turn that has decided something ends with the plain question — ask, then stop, then
wait"*. Regression tests in `prompt-contract.test.ts` (5/5 green) incl. a guard that the two
dump-teaching examples never return. **Zero scenario literals** — the existing anti-overfit scanner
passes.

## Files added to context (goal 2 / baseline re-run)

- `libs/core/src/session/session.ts` (`maybeSummarizeHistory`) + `libs/core/src/context/summarize.ts`
  — the digest Act XIII tests; established it is deterministic and drops all assistant replies.
- `libs/cli/src/server/session-manager.ts:413` — `maxHistoryTurns: 20` on the pod (so the threshold
  Act XIII must cross is 40 messages).
- The live session on disk (`sessions/<id>/{snapshot,trace,meta}.json`) — corrected Act XIII's
  real-state path (sessions are DIRECTORIES, not `<id>.json`) and read turn 1's actual displays,
  which is what exposed both THING bugs.
- `libs/core/system-spaces/user-thing/agents/thing/instruct.md` — THING's shared triage brain.

### Baseline run #3 results (wiped project, attribution fix in) — 1 fix CONFIRMED, 1 REGRESSION, 1 ROOT CAUSE FOUND

**The attribution fix is CONFIRMED live.** All **6/6** audio-only tokens now reach real state —
including `Δέσποινα` and `Λευκάδα`, which were the two that failed before the fix. Before: 4/6, the
provenance dropped. After: 6/6. That is the before/after evidence for `e127990`.

**But this build REGRESSED badly, and it exposed the real bug underneath everything.**

- The app did **not build**: `built:false`, `routes:0`, `/app/family-recipes/` → **404**. The
  anti-expectation itself.
- The table set is `meal_plan, pantry, recipe_ingredients, recipe_steps` — **there is no `recipes`
  table at all**, and no `shopping_list`. `recipe_ingredients.recipe_id` is a foreign key pointing at
  a parent that was never created. A recipe book with no recipes.
- The `functions` typecheck errors were **still unrecovered** — the sibling core commits did not fix
  them, because they are not a core bug.

**ROOT CAUSE (reproduced, not inferred) — a system prompt hands the model code that cannot compile.**
`system-architect/tasklists/synthesize_and_run/01-design.md` told the model to write:

```ts
const functions = [];
currentTask.resolve({ slug, goal, actionId, fields, functions });
```

A bare `[]` is an *evolving array*: push to it and TS infers the element type — but **use** it before
anything is pushed and the type can never be determined. Checked against the repo's own `tsc
--strict`, that exact shape fails with precisely the two errors in the live trace:
`TS7034` + `TS7005: Variable 'functions' implicitly has an 'any[]' type`. With the annotation, clean.

The model copies the example verbatim, so this fires on **every specialist build, in every scenario**.
And the retry cascade is a **trap**: redeclaring gives *"Cannot redeclare block-scoped variable"*,
assigning gives *"Cannot assign to 'functions' because it is a constant"*. The loop cannot escape,
exhausts `maxRetries`, and the authoring turn is spent — which is why the app never got its pages.
The live trace shows the model commenting *"the previous attempt redeclared `functions`"* as it
thrashes.

**Fixed + committed (`a4b5bc5`)**: annotate the type in the design node. Regression test in
`prompt-contract.test.ts` (6/6 green) asserting the bare form never returns.

### Commits so far this session
- `e127990` — automator: keep the ATTRIBUTION material carries (+ test). **Live-confirmed 6/6.**
- `116c3c5` — scenario: Acts XIII–XV (gaps M, L, L).
- `2b96f53` — ⚠️ THING's SHARED brain: stop teaching it to dump raw internals (8 examples); make it
  ASK before it stops (+ tests).
- `53bc585` — scenario: Act XIII reads the real session layout.
- `a4b5bc5` — architect: the design node's uncompilable `functions` example (+ test). **The big one.**

## Round 1 CLOSE-OUT (2026-07-14)

**Verdict: FAIL** — honestly recorded. The ingestion half of the scenario is fully proved; the app
the scenario exists to produce did not build. Acts I–III driven live; **Acts IV–XV not yet run**
(resumable from `results/checkpoint.json`).

**Final verification run was still in flight at close** — turn 1 ran >75 min without producing a
build (vs 200 s on the previous run). The `functions` trap errors are GONE from the trace (the
`a4b5bc5` fix is working at the typechecker level), but **the app has not yet been observed building
green**, so the architect fix is NOT yet end-to-end verified. That is the first thing round 2 must do:
wipe the project, re-run `--acts=1 --fresh`, and confirm `built:true` with a `recipes` table.

Also unexplained and worth watching: turn 1 got dramatically SLOWER after the prompt edits. Either the
local server is contended by sibling lanes, or one of my `user-thing` edits (`2b96f53`) made THING
thrash. If round 2 sees the same, **bisect `2b96f53` first** — it touches the shared triage brain.

### Everything committed (sdk/org, then the parent pointer `50eedd23`)
- `e127990` automator: keep the ATTRIBUTION material carries (+ test) — **live-confirmed 4/6 → 6/6**
- `116c3c5` scenario: Acts XIII–XV (coverage gaps M, L, L)
- `2b96f53` ⚠️ user-thing SHARED brain: 8 dump-teaching examples removed; ASK-then-stop rule (+ tests)
- `53bc585` scenario: Act XIII reads the real session layout
- `a4b5bc5` **system-architect: the design node's uncompilable `functions` example (+ test) — the big
  one; it broke the app build in EVERY scenario**
- `a151c56` scenario: Act III/XV bind via `spaceRef`; probes no longer crash the run
- `b718569` scenario: round-1 Actual results + the honest narrative

`pnpm test libs/core/src/spaces` → **155/155 green**. Anti-overfit scanner passes (zero scenario
literals in any agent's brain).

### For round 2, in order
1. Re-verify `a4b5bc5` end-to-end: wipe, `--acts=1 --fresh`, expect `built:true` + a `recipes` table.
   If turn 1 is still pathologically slow, bisect `2b96f53`.
2. Then drive Acts IV–XV live for the first time (IV–XII baseline + the three new ones).
3. The **missing-parent-table** bug is still OPEN and unfixed: the builder authored
   `recipe_ingredients`/`recipe_steps` with a `recipe_id` FK and never created `recipes`. Likely a
   general principle for the automator/data-modeler ("create the parent entity before its children; a
   child table whose foreign key points at a table that does not exist is a broken app") — but do NOT
   land it until it is seen again on a build that is not also poisoned by the typecheck trap, since
   the trap is the more likely cause of the truncated build.
