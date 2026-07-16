# 06-tanzania — Round 16 report

## Verdict

**Step 2 still fails.** This round fixed and freshly verified the app-build handoff, but the same replay proved that the organizer’s inventory continues to choose cross-cutting facets as specialist scopes rather than the independently owned segments required by the scenario. Per the one-failure rule, the runner was stopped after step 2.

## Change 1 — live-project app handoff

- **Rung:** L2 — a tasklist node selected the wrong existing structural path.
- **Files:**
  - `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/03-build_app.md`
  - `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts`
  - `org/docs/system-spaces/README.md`
- **Why this rung:** The first clean replay’s step-2 evidence recorded the node delegating to `system-appbuilder/app-architect/build_app`, then ended with no project tables, no pages, and `built:false`. The full trace shows the catalog action tasklist but no project-writer yields. This is an explicit source-level routing mistake, not a framework failure.
- **General principle:** A workflow that must change the current project must delegate to the writer whose capabilities target that project. A catalog/template authoring pipeline is not a substitute merely because both are called “app builds.” A data model or survey is not a completed app; the result must expose source-derived rows through project API(s) and page(s).
- **Before → after:** `03-build_app` formerly allowed and hard-coded `app-architect#build_app`; it now allowlists and calls `automator`, while explicitly requiring source-derived tables/rows plus an openable page backed by the project API. The DAG regression assertion and system-space documentation now name the same live-project path.
- **Overfit check:** The added prompt and test wording contains no persona, fixture, place, table, or scenario-domain literal. `git diff` grep found no Tanzania-specific term in the changed source/docs/test hunk.

## Evidence

### Failing baseline

`verify-step-02/step-02.json` recorded:

- delegates: three `system-architect/architect/synthesize_and_run` plus `system-appbuilder/app-architect/build_app`;
- state: three spaces, `appTables: {}`, `pageCount: 0`, `built: false`.

`verify-step-02/step-02.full.json:117-127` confirms the organizer’s exact catalog-action delegate and nested catalog tasklists, with no live-project authoring afterwards.

### Verification replay

After rebuilding `@lmthing/cli`, `verify-step-02-rerun-2/step-02.json` recorded:

- delegate target changed to `system-appbuilder/automator`;
- state contains `costs: 9`, `memories: 2`, `stops: 12`, and `tariffs: 4` rows;
- manifest has four authored pages.

`verify-step-02-rerun-2/step-02.full.json:135-269` confirms the direct automator handoff and later inspection of `_layout.tsx`, `index.tsx`, `costs.tsx`, `memories.tsx`, `tariffs.tsx`, plus four project API route directories. The compact manifest reports `built:false` because the second automator pass cache-hit the page build; page presence is the material result of the corrected handoff.

Validation passed:

```text
pnpm --dir sdk/org exec vitest run libs/core/src/spaces/system-spaces-dag.test.ts libs/core/src/spaces/prompt-contract.test.ts
29 passed
```

(The test loader emitted its pre-existing warning that the automator’s prose mentions `delegate()` despite its empty `canDelegateTo`; this did not fail the suite.)

## Remaining failure — scope partition

The same fresh verification is still a failure against the first step-2 expectation. It created:

- `Ngorongoro Tariff Reference`
- `Tanzania Trip Dashboard`
- `Trip Cost Tracker`
- `Trip Memories`

These are cross-cutting facets, exactly the classes `organize_material/01-inventory.md` already prohibits. The expected independently owned segments were not created. The full trace names the four invalid inventory items at `verify-step-02-rerun-2/step-02.full.json:71-108`.

No web-search/fetch yield appeared, so the supplied-material/no-research behavior held. The app handoff was verified, but the step cannot pass until the partition is reliable.

The attempt ledger records multiple prior prose adjustments for this decision. Another L1 sentence would repeat an exhausted rung. The next round should design an enforceable, domain-neutral structured partition contract at the `inventory.scopes → build_specialist.forEach` boundary (likely an L3 schema/validation capability if today’s task-output schema cannot express segment ownership, coverage, and forbidden facet classes). It must not restore the catalog handoff, the duplicate direct build path, or a free-form prompt-only partition retry.

## Uncommitted files for review

- `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/03-build_app.md`
- `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts`
- `org/docs/system-spaces/README.md`
- `automation/instances/scenario-campaign/attempts/06-tanzania.md`
- `automation/instances/scenario-campaign/rounds/16/06-tanzania/PROGRESS.md`
- `automation/instances/scenario-campaign/rounds/16/06-tanzania/report.md`

No files were staged or committed.
