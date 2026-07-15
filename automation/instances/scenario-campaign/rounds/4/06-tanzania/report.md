# 06-tanzania — round 4, attempt 1 report

## Verdict

**Step 02 failed on the initial replay.** The failure was correctly attributed to **L1 prompt behavior**, not the scenario or a missing framework primitive: the direct one-shot probe that explicitly required supplied-only facts, per-leg specialists, and pages still researched the web and left the app without pages. The same builders can write seeded DB rows and pages, so a lower L1 correction is expressible.

The source changes were rebuilt and replayed from a clean local server through steps 01–02. The rerun **verified the narrow research-fallback repair**: it produced no `fetch`, `webSearch`, or `webFetch` yield in step 02; specialist setup no longer delegates to a just-created agent. It **did not fully verify step 02**, so the invocation remains an honest **FAIL**: the rerun created only Safari and Zanzibar specialist spaces rather than distinct Cairo, Safari, Zanzibar, and Dar es Salaam spaces. It also contains recovered authoring errors, and the state snapshot reports `built: false` despite generated pages. Per the one-failure rule, no later scenario steps were judged.

No commits, staging, stashing, or branch changes were made.

## Initial failure evidence

Source: `attempt-1/step-02.json`.

* The setup created only `Ngorongoro Advisor`, `Stone Town & Zanzibar Guide`, and generic `Tanzania Trip Overview` (not one specialist per required leg).
* After registering the new Zanzibar specialist, THING ran it during setup. Its incomplete static knowledge returned `covered:false`, which triggered `research_and_store`; the trace has a Tavily request (`yield` 24: `fetch https://api.tavily.com/search`) followed by two page fetches. This violates the supplied-material/no-research invariant.
* The appbuilder wrote DB tables and APIs but no pages: the end snapshot has `appManifest.pages: []`, `built: false`; the trace then records a second delegated request stating that pages were missing. Therefore the app could not be judged openable.
* Recovered typecheck failures included the architect's `const research = JSON.parse(research)`, a prohibited `console.error`, an uninitialized `const validate`, missing `glob`/`listDir`, and appbuilder's undeclared `tables/pages/hooks/events` inventory statement. Some rows landed despite these errors, but the actual deliverable did not.

Step 01 passed its relevant checks: it delegated to `system-vision/vision` and `system-files` readers, offered an app naming trip-specific material, and its captured state was empty (no spaces/tables/pages).

## Attribution probe

Source: `probe-direct/step-02.json`.

The probe phrased the same build demand directly: preserve supplied facts, do not look anything up, create per-leg specialists, and finish phone pages. It still emitted five `fetch` yields and ended with `pages: []`, `built: false`. This rules out the persona wording and scenario expectation as the cause. The primitive itself is capable of seeding rows and writing pages, so no L2/L3 change was warranted.

The temporary `probe-direct.yaml` was deleted. Its evidence directory remains for review.

## Product changes

All product changes are in the `sdk/org` submodule and remain uncommitted.

### 1. `libs/core/system-spaces/user-thing/agents/thing/instruct.md`

* **Rung:** L1.
* **Change:** The compound app route now requires a complete list of distinct factual parts, rather than permitting a generic catch-all specialist. It also states that user-supplied material is the complete setup source: seed it into the architect handoff and do not run a new specialist's `answer` action during setup.
* **General principle:** A setup operation must preserve the supplied corpus and must not convert partial setup knowledge into a research request. Distinct user domains merit distinct owners; a generic overview hides later routing gaps.
* **Before → after:** the original step 02 setup ran the freshly-created Zanzibar specialist and fetched web results. The verification trace has only architect/appbuilder delegates, tasklists, `registerSpace`, attachment `readDocument`, and `inspect`; no network fetch occurs.

### 2. `libs/core/system-spaces/system-architect/agents/architect/instruct.md`

* **Rung:** L1.
* **Change:** Architect's second turn reports synthesis coordinates instead of immediately delegating to the newly-created specialist on the setup topic.
* **Why:** The initial trace showed exactly that setup delegate causing the unnecessary research fallback. A specialist should be run for an actual later question, not to test a partial corpus.

### 3. `libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/04-write_agent.md`

* **Rung:** L1.
* **Change:** The synthesis task’s generated-agent contract now explicitly prohibits delegating to the new agent during setup while retaining the later-question research-and-store path.
* **Why:** This supplies the same rule at the task artifact that generates the agent, rather than relying on one caller’s wording.

### 4. `libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md`

* **Rung:** L1.
* **Change:** A repair request identifying a missing page is explicitly a write request: author the missing home page/read API immediately rather than inventorying the project.
* **Why:** In the original run, a follow-up delegate named the absent pages but the snapshot still ended with no pages. The repair instruction must produce the page, not a diagnosis.

### 5. `libs/core/src/spaces/prompt-contract.test.ts`

* **Rung:** L1 regression coverage.
* **Change:** Added prompt-contract assertions for the no-new-agent-during-setup and missing-page-repair principles.
* **Test:** `pnpm --dir sdk/org --filter @lmthing/core test --run src/spaces/prompt-contract.test.ts` passed. `pnpm --dir sdk/org --filter @lmthing/cli... build` also passed, copying the revised system spaces into CLI `dist`.

## Verifying rerun evidence

Source: `attempt-1-verify/step-02.json`.

* **No unnecessary research:** `yieldKinds` are `delegate`, `tasklist`, `registerSpace`, `readDocument`, and `inspect`; there are no `fetch`, `webSearch`, or `webFetch` yields. This fixes the specific first observed failure.
* **Seeded DB state:** the snapshot contains non-empty `itinerary`, `costs`, `park_fees`, `action_items`, and `memories`; `itinerary` contains flight reference `ZZJQUU`; action items contain Emmanuel and the ~5,000 TZS ranger tip; pages were written to the manifest.
* **Still failing:** spaces are only `Tanzania Safari Advisor` and `Zanzibar Advisor`, omitting Cairo and Dar es Salaam. The required distinct-leg invariant remains unmet. The photo memory contains only an attachment note rather than image-specific camera/content evidence, and no captured space knowledge proves the PDF hotline. Three architect `aspectOverviews is not defined` errors and two appbuilder typecheck errors were recovered. `appManifest.built` remains `false`; browser rendering was therefore not attempted.
* **Clean-run caveat:** `run.log` reports `WARNING: fresh pod already has 2 project(s) — expected 0`, even though the runner recreated the target project and replayed the steps. This is a pre-existing runner/fresh-state issue in the submodule worktree, not changed in this invocation.

## Scenario-literal guard

A grep over the changed architect and THING prompt directories found only the pre-existing generic Zanzibar examples in the three-store routing material; none of this scenario's person names, booking reference, guide name, fixture-specific amount, table names, or other scenario facts was added. In particular, no new `Vasilis`, `Athina`, `Tanzania`, `Ngorongoro`, `ZZJQUU`, `Emmanuel`, `Stone Town`, or `3344` literal entered the modified architecture prompt files.

## Remaining work

The next invocation should treat the remaining step-02 specialist coverage failure as the next first failure: strengthen THING's actual post-offer planning so it enumerates every material-backed itinerary leg and passes sufficient facts to each architect delegate, then verify from step 01 through step 02. Do not proceed to step 03 until that step is fully green.
