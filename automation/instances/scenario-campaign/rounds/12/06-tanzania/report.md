# 06-tanzania — round 12 report

## Verdict

**Step 2 still fails; the L1 correction did not verify.** The initial clean replay (`attempt-2`) created app data but **zero** specialist spaces because THING bypassed `organize_material` and called only `system-appbuilder/automator`. I changed the supplied-material consent path to make `organize_material` its only authoring call and reran from fresh servers through step 2.

The correction changed the routing as intended, but attempts 3 and 4 still over-fragmented the organizer’s inventory and left the app unserved. Attempt 4 is the final verification: it registered eight off-partition spaces, created only a single `itinerary` row, and reported `pageCount: 0`, `built: false`. The scenario requires one specialist per leg and a served app with real rows, so this is an honest FAIL. No files were staged or committed.

## Evidence

### Attempt 2 — failure before the correction

- `attempt-2/step-01.json` passed: it read all five attachments with `system-vision/vision`, `system-files/dispatch`, `reader`, and `sheet`; state remained empty and the reply offered an app.
- `attempt-2/step-02.json` had a sole `system-appbuilder/automator` delegate, no tasklist yield, and no `system-architect` delegates.
- Its state had five populated tables (`cost_items: 18`, `itinerary_legs: 8`, `loose_ends: 8`, `park_fees: 50`, `trip_notes: 32`) but `spaces: []`, `spaceCount: 0`, and `appManifest.built: false`.
- Full evidence shows the direct handoff: `delegate('system-appbuilder','automator', …)`. This violates the intended accepted-offer route and independently fails the first step-2 expectation.

### Attempt 3 — fresh verification after organizer-only routing

- `attempt-3/run.log` confirms a clean pod root and `played 2/18 steps`.
- `attempt-3/step-01.json` passed again: attachments were read, no authoring happened, and the reply offered an app.
- `attempt-3/step-02.full.json` begins with `tasklist('organize_material', …)`, followed by architect delegates for all four required operational scopes. No web-search or web-fetch yield occurred.
- But `attempt-3/step-02.json` listed 11 registered spaces, including the required four plus `Arusha Safari Gateway`, `Flight Advisor`, `Travel Documents Advisor`, `Rock Restaurant Concierge`, `Ngorongoro Souvenir Memo`, `Traveler Profiles`, and `Trip Budget`.
- Its compact state had populated tables but `appManifest.built: false`. Recovered typecheck errors included implicit callback `any`, unfinished declarations, unavailable `console`, and follow-up references to unavailable `result`.

### Attempt 4 — final fresh verification after partition tightening

- `attempt-4/run.log` confirms a clean pod root and the runner completed `2/18` steps.
- `attempt-4/step-01.json` passed without errors: all attachment delegates landed, state was empty, and it offered the app.
- `attempt-4/step-02.full.json` again starts with `tasklist('organize_material', …)`. It then fans out into budget, broad logistics, fee/regulation, voice-note, and photo scopes — not the required four operational scopes. It also shows a repeated `organize_material` tasklist and two automator delegates before the turn ended.
- The compact final state has eight spaces: `Field Notes`, `Ngorongoro Fees Advisor`, `Ngorongoro Fees & Regulations`, `Ngorongoro Memo`, `Stone Town Photo Memory`, `Tanzania Trip Planner`, `Trip Budget Tracker`, and `Trip Logistics Agent`.
- State contains only `itinerary: 1`; `pageCount: 0` and `built: false`. The app therefore cannot satisfy the served-app expectation.
- No `webSearch` or `webFetch` yield occurred, so the no-research invariant remained sound. The primary failure is the structured inventory/handoff, not research.

## Attribution and changes

### L1 — `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md`

**Why this rung:** previous history had already proved two scope-completeness prose attempts ineffective and supplied an L2 organizer. R11 identified conflicting manual build routes. Attempt 2 confirmed the remaining caller-level defect: THING skipped the organizer and directly invoked automator. The existing format could express the required workflow, so an L3 framework change was not justified.

**Change:**

- Limits the supplied-content shortcut in path 3 to a standalone specialist request, removing an implied competing multi-scope route.
- Replaces accepted-offer prose with explicit `tasklist('organize_material', …)` code.
- Makes that tasklist the only authoring call; THING must not invoke architect or automator before or after it.

**General principle:** an orchestrator must choose one owning workflow for a compound operation. Once a workflow owns inventory, fan-out, and handoff, its caller must not repeat any stage independently; duplicate ownership causes races, omissions, and inconsistent output.

**Behavioral proof:** attempts 3 and 4 issued the organizer tasklist rather than the direct automator-only route from attempt 2. The correction does not yet prove the overall scenario expectation because the organizer itself remains unreliable.

### L1 — `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/01-inventory.md`

After attempt 3, I narrowed the inventory rule to request the coarsest complete, non-overlapping operational partition: do not create child scopes whose questions and facts belong to a parent; do not split simply because details differ.

Attempt 4 **did not verify** this change. It chose cross-cutting budget/logistics/document/photo scopes rather than the required operational boundaries, then re-entered the organizer. The tasklist’s free-form inventory decision remains systematically wrong despite the prompt correction.

**Next diagnosis:** this is now an L2 reliability issue inside `organize_material`, not a reason to restore THING’s direct calls. Trace the tasklist’s input/output boundary and eliminate the re-entry; the structure must deterministically enumerate one non-overlapping operational partition and hand off to automator exactly once. If the existing `forEach` tasklist cannot express this fixed partition without relying on model judgment, document the missing primitive before considering L3.

### Regression coverage — `sdk/org/libs/core/src/spaces/system.test.ts`

Updated the existing THING prompt contract to assert the organizer-only accepted-offer path instead of the removed free-form “build parts” sentence. I also made its multiline offer assertion whitespace-tolerant.

Targeted tests passed:

```text
Test Files  3 passed (3)
Tests       37 passed (37)
```

The test run retained pre-existing warnings that automator’s instruction mentions `delegate()` while frontmatter has `canDelegateTo: []`; tests did not fail on them.

## Documentation and quality checks

- The inherited documentation update in `org/docs/system-spaces/README.md` remains in the uncommitted tree and describes the organizer DAG. No additional documentation claim was introduced this round because the new behavior did not verify.
- `git -C sdk/org diff --check` passed.
- The CLI was rebuilt before attempts 2, 3, and 4.
- Prompt/tasklist/test changes were checked for scenario literals and scenario-domain framing. The new prose names only workflow ownership and non-overlapping partitions; no persona name, fixture token, location, booking reference, or total was added.

## Existing uncommitted changes retained

This round relied on and left intact earlier uncommitted L2 organizer files, the architect one-statement action contract, DAG/prompt tests, harness timeout increase, compact runner evidence, and matching documentation. I did not modify, stage, restore, or remove unrelated worktree changes.

## Artifact locations

- Initial caller failure: `automation/instances/scenario-campaign/rounds/12/06-tanzania/attempt-2/{step-01,step-02}.{json,full.json}`
- First organizer verification: `automation/instances/scenario-campaign/rounds/12/06-tanzania/attempt-3/{step-01,step-02}.{json,full.json}`
- Final organizer verification: `automation/instances/scenario-campaign/rounds/12/06-tanzania/attempt-4/{step-01,step-02}.{json,full.json}`
- Progress log: `automation/instances/scenario-campaign/rounds/12/06-tanzania/PROGRESS.md`
- Persistent attempt record: `automation/instances/scenario-campaign/attempts/06-tanzania.md`
