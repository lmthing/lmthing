# 06-tanzania — round 14 report

## Verdict

**Step 2 remains FAIL after two clean verification reruns.**

The first replay (`attempt-1`) showed a systematic organizer re-entry: fourteen architect delegates and four automator delegates created seven overlapping spaces and left the app unbuilt. The first source change made THING consume the organizer result inline, eliminating the original caller-side cross-statement continuation. `attempt-2` then invoked the organizer once, made four specialists, and invoked the automator once; this proves that fix removed that concrete re-entry path. It still failed the scenario because the inventory partitioned the material by storage facet rather than its operational segments, and its manifest remained `built:false`.

The second source change clarified the inventory axis. In fresh `attempt-3`, the first organizer execution did enumerate bounded stages (Cairo, pre-safari, safari, Zanzibar, return), but it then re-entered a second time in the same user turn. The compact trace records two `organize_material` tasklists, ten architect delegates, and two automator delegates; the final state contains seven overlapping spaces, one `itinerary` table, zero pages, and `appManifest.built=false`. The scenario's required app and exact per-leg specialist structure are therefore not proved.

No more L1 wording is justified: the active instruction already tells THING to issue one statement, consume the result inline, and not re-enter. The remaining repeat is a structural reliability gap: a tasklist invocation has no runtime-enforced single-execution boundary for a user turn. This round stops after the requested limited number of fresh attempts rather than overfitting another prompt sentence.

## Changes

### `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — L2 structural caller contract

Changed the accepted supplied-material path to call `organize_material` and compose its closing reply from the envelope in the **same statement**. The instruction explicitly forbids a second organizer call, a direct architect/automator call, or post-tasklist authoring.

**Why:** In the failing first replay, the organizer was called again after its first completion. Cross-statement values do not persist, and the previous shape permitted a continuation that retried the build.

**Before → after evidence:**

- `attempt-1`: 14 architect + 4 automator delegates; 7 overlapping spaces; interrupted at 15 minutes; `built:false`.
- `attempt-2`: 4 architect + 1 automator delegates; a single organizer invocation; normal completion in 389 seconds. The original retry path was removed.
- `attempt-3`: the model still started a second organizer execution despite the correct inline contract, showing the remaining defect is no longer an expressible prompt-only fix.

### `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/01-inventory.md` — L2 inventory structure

Made the partition rule select the material's primary operational axis: bounded stages for a sequence, independently-run operations for parallel work. It rejects storage facets (costs, contacts, documents, media, records) as specialist scopes.

**Why:** `attempt-2` succeeded in single execution but created facet specialists rather than operational segments. This is a general routing principle; it contains no scenario literal or domain-specific instruction.

**Before → after evidence:** `attempt-3`'s first organizer fan-out produced stage-like scopes rather than facet-only scopes. However, a second organizer execution subsequently overlaid a second incompatible partition, so the final state remains invalid.

### Regression tests and documentation

- `sdk/org/libs/core/src/spaces/prompt-contract.test.ts` asserts that supplied-material organization consumes the envelope inline and forbids re-entry.
- `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts` asserts the organizer node shape and the primary-operational-axis inventory contract.
- `org/docs/system-spaces/README.md` documents the organizer workflow, its inline envelope consumption, and its partition rule.

No core runtime change was made, so no L3 test applies. `pnpm docs:check` passed (118 docs, 4,556 citations), focused `@lmthing/core` prompt/DAG tests passed, and `pnpm --dir sdk/org --filter @lmthing/cli... build` passed.

## Evidence

### Initial failure — `attempt-1/step-02.json`

- `delegates`: 14 architect calls and 4 automator calls.
- State: 7 overlapping spaces (`Ngorongoro Park Fees`, `Photo Gallery`, `Travel Notes & Trip Log`, `Trip Costs & Expenses`, `Trip Logistics`, `Voice-Memo Notes`, `Voice Memo Organizer`); 8 tables; `pageCount: 1`; `built:false`.
- The turn was interrupted after 908,976 ms.

### First clean rerun — `attempt-2/step-02.json`

- `delegates`: exactly 4 architect calls and 1 automator call.
- No `webSearch`/`webFetch` yield occurred.
- State: 4 spaces and 4 seeded tables, but `built:false`; the spaces were storage-facet categories rather than all required operational segments.

### Final clean rerun — `attempt-3/step-02.json` and `.full.json`

- The first `organize_material` invocation created bounded-stage candidates: Cairo Stopover, Arusha Pre-Safari, Northern Tanzania Safari Circuit, Zanzibar / Stone Town, and Return Travel.
- The trace then shows a second `organize_material` invocation, further architect calls for a different partition, and a second automator call.
- Final state: 7 spaces, including overlapping `Northern Tanzania Safari Circuit` and `Safari Planner`; `itinerary: 36`; `pageCount: 0`; `built:false`.
- No web research occurred, and source-state evidence includes the voice-memo facts Emmanuel and the TZS 5,000 ranger-tip detail. The state does **not** prove every required fixture token or the served app.

## Overfitting check

`grep` found no Tanzania-specific persona, fixture, or table literals in the new `organize_material` tasklist text. The changed instruction speaks only in general terms: operational axes, stages, independently-run operations, and storage facets.

## Next step

Treat the remaining defect as an **L3 candidate**: trace the tasklist/turn runtime to identify where a completed tasklist can be invoked a second time within one user turn, then add a runtime-enforced single-execution or completion boundary with a regression test. Do not restore the old direct build path or add another prompt-only warning.
