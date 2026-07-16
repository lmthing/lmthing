# Tanzania scenario — round 1 report

## Verdict

**FAIL — step 02; not verified after three fresh replays.**

The first run did create three specialist spaces and populated eight project tables. It authored `pages/_layout.tsx`, `pages/index.tsx`, and `api/dashboard/GET.ts`, but did not publish an app. Step 03's forced rebuild exposed the first concrete failure: the endpoint omitted its required `export const name`, so the API loader rejected the project and `/app/tanzania-trip/` returned 404.

I made an L1 change to the system-appbuilder openable-app task, rebuilt, and ran two clean replays through step 03. The second replay fixed the missing endpoint name but exposed invalid generated-page imports. I extended the same task contract with the supported generated-project import boundary and runnable templates. The final clean replay regressed earlier: step 02 retained only one populated `itinerary` table and authored no page, so step 02 itself again failed the openable-app assertion. Per the one-failure limit, I stopped rather than proceed to step 03 or add scenario-specific instructions.

## Change

### `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/03-write_openable_app.md#write_openable_app`

- **Rung:** L1 prompt/task-node contract.
- **Why this rung:** The first failure was a correct intent expressed as invalid authored source. The runtime already has `writeProjectApi`, `writeProjectPage`, `@app/runtime`, and a build route. Step 03 precisely identified missing endpoint metadata; no primitive was missing.
- **General principle:** A generated app is not complete merely because source files exist. Its endpoint source must satisfy the loader's full module contract, and its pages must use only dependencies provided by the generated-project runtime.
- **Change:** Required `name`, `description`, `Input`, `Output`, and a default async `ctx.db` handler for every API. Required pages to import `useApi`/`Chat` from `@app/runtime`, use ordinary React/design-token markup, and accept `children` in the layout rather than importing unavailable routing/UI packages. Replaced placeholders with runnable API, page, and layout examples.
- **Overfit check:** Grep found no persona, place, fixture, table, or other Tanzania-scenario literal in the task diff.

## Evidence

### Initial replay — `attempt-1`

- **Step 01 PASS:** delegates included `system-files/dispatch`, `system-vision/vision`, `system-files/reader`, and `system-files/sheet`; `spaceCount: 0`, no tables/pages.
- **Step 02 partial success:** three spaces (`Ngorongoro Crater Logistics`, `Tanzania Travel Advisor`, `Zanzibar Advisor`) and eight populated tables. The compact manifest showed `pageCount: 1`, `built: false`.
- **Step 03 decisive failure:** `POST /api/projects/tanzania-trip/app/build` returned 400:

  ```
  [api-loader] .../api/dashboard/GET.ts: missing `export const name` (every endpoint must be named)
  ```

  The app root was 404. This established a genuine publish failure, not a manifest-observability issue. The trace's lack of `writeProject*` yields is expected because those injected writers are synchronous rather than yield-router calls.

### First verification — `attempt-2`

- Steps 01–02 again read the sources, created three specialists, and created seven populated tables.
- The previous API-loader error did not recur.
- Step 03 then failed compilation instead:

  ```
  Could not resolve "react-router"
  Could not resolve "@agent-chat/react"
  Could not resolve "@radix-ui/themes"
  Could not resolve "../../use-api"
  ```

- The generated `pages/_layout.tsx` and `pages/index.tsx` confirmed those unsupported imports. This motivated the second, still domain-neutral portion of the same L1 task contract.

### Final verification — `attempt-3`

- Step 01 passed: all attachment specialists ran, nothing was authored yet.
- Step 02 created three specialist spaces but only one populated `itinerary` table and no pages (`pageCount: 0`, `built: false`). Its turn had recovered typecheck errors from unrelated system-space actions, including `console` and an undefined `built` variable. Since no page was authored, the openable-app expectation failed before step 03.

## Validation

- `pnpm --dir sdk/org --filter @lmthing/core... build` — PASS.
- `pnpm --dir sdk/org --filter @lmthing/cli... build` — PASS; copied the modified system spaces into CLI `dist`.
- `pnpm --dir sdk/org test libs/core/src/spaces/system-spaces-dag.test.ts` — PASS (16 tests). It emits pre-existing warnings that `automator` has `canDelegateTo: []` while its instructions mention `delegate()`.
- Fresh scenario replays: `attempt-1` established the API metadata failure; `attempt-2` verified that metadata issue was fixed and uncovered invalid imports; `attempt-3` did not reach an app build because the model's data node partially completed.

## Remaining state / recommended next attribution

The current L1 instruction is clearer but has not verified the original step. The final replay's partial single-table build is not the same reproducible source-shape error as the first two app-publish failures. Before another prose attempt, trace the `build_live_project` task orchestration and its task-fork context/result handling: the final trace shows a data-only partial completion plus unrelated typecheck-recovery behavior. If that is systematic across another clean replay, classify it as L2/L3 structural reliability rather than repeatedly expanding the task prose.

No commits, staging, stashes, branch changes, or destructive operations were performed. Product change remains uncommitted in the sdk submodule; ledger/progress/report and replay artifacts remain uncommitted at the repository root.
