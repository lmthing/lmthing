# Tanzania scenario — round 15 report

## Verdict

**Step 2 failed; not fixed after two fresh verification replays.** Step 1 passed on every replay: all supplied files were read through the document/sheet/vision/audio paths, THING made an offer using real material, and no project state was authored.

The first replay reproduced the known step-2 failure: `organize_material` executed twice, producing eight overlapping spaces, eleven architect delegates, two appbuilder delegates, and an unbuilt app. The first verification confirmed that the L1 fix removed this re-entry, but exposed a direct-automator completion without any authored project artifacts. The second verification routed app construction through the app architect's action DAG, created exactly four appropriately scoped specialists, and invoked one `app-architect#build_app` delegate; nevertheless the nested build finished before creating a project or authoring a table/page. The app still has `appTables: {}`, `pageCount: 0`, and `built: false`.

## Changes

### L1 — trust a completed workflow envelope

- **File / symbol:** `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — accepted supplied-material offer path.
- **Test:** `sdk/org/libs/core/src/spaces/prompt-contract.test.ts` — `user-thing supplied-material organization`.
- **Documentation:** `org/docs/system-spaces/README.md` — `user-thing/organize_material`.
- **Why this rung:** failing evidence showed two `organize_material` yields in the same user turn. After the first workflow had registered spaces and delegated the app build, THING used `inspect()` to independently rederive project state, encountered a recovered error, and restarted the workflow. The error-prone post-workflow verification was a caller decision, not a missing primitive.
- **General principle:** once an orchestrating workflow returns its envelope, the caller reports that outcome and stops; it does not independently reconstruct partial results or restart completed work.
- **Result:** verified. In `verify-step-02/step-02.json`, one organizer yielded one specialist and one direct appbuilder delegate. The original duplicate-work failure was removed.

### L2 — use the deterministic app-build action boundary

- **File / symbol:** `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/03-build_app.md`.
- **Test:** `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts` — shipped `organize_material` DAG assertions.
- **Documentation:** `org/docs/system-spaces/README.md` — `user-thing/organize_material`.
- **Why this rung:** with re-entry gone, the direct `system-appbuilder/automator` delegate returned after a recovered survey-variable typecheck error, but the state contained no tables or pages. A direct broad writer has no deterministic completion boundary. The existing `app-architect#build_app` action owns a host-driven `design → create project → per-file authoring → finalize` tasklist, so selecting that action was the lowest structural correction.
- **General principle:** a request that must produce a complete multi-step deliverable should go through its fixed action workflow rather than a broad direct writer that can report after an intermediate survey.
- **Result:** not sufficient. In `verify-step-02-rerun-2/step-02.json`, the runner recorded exactly four specialist-space delegates and one `system-appbuilder/app-architect/build_app` delegate. Its full evidence records nested `build_app` tasklist yields, but no `createProject`, table, API, or page writer yields. The final project has no app artifacts.

## Evidence

### Initial failure

`attempt-1/step-02.json`:

- eleven architect delegates and two automator delegates;
- `spaceCount: 8` with overlapping names including `Cairo Stopover`, `Northern Tanzania Safari`, `Tanzania Safari Tracker`, and duplicate Zanzibar/Arusha variants;
- populated source rows but `appManifest.built: false`.

`attempt-1/step-02.full.json` records the first `organize_material` yield at lines 43–46 and a second at lines 233–236. Between them, the first run had already registered spaces and delegated the app builder.

### First verification — L1 works, direct writer does not

`verify-step-02/step-02.json`:

- one architect delegate and one `system-appbuilder/automator` delegate;
- `spaceCount: 1`, but `appTables: {}` and `built: false`.

`verify-step-02/step-02.full.json:138-142` records the direct automator's recovered `Cannot find name 'existingTables'`, `existingPages`, `existingHooks`, and `existingEvents` error while it attempted to return a survey result. No project mutation followed.

### Final verification — L2 action handoff still returns early

`verify-step-02-rerun-2/step-02.json`:

- four architect delegates, one `system-appbuilder/app-architect/build_app` delegate, and no duplicate organizer invocation;
- four scopes: `Itinerary Logistics`, `Ngorongoro Crater Safari`, `Trip Costs & Budget`, and `Zanzibar & Stone Town`;
- no web-search/fetch yields;
- `appTables: {}`, `pageCount: 0`, `built: false`.

`verify-step-02-rerun-2/step-02.full.json:124-134` records the action delegate and its two nested `build_app` tasklist yields. There are no `createProject`, `writeTableSchema`, `writeApi`, or `writePage` yields anywhere in the trace. The remaining issue is therefore inside the nested action-tasklist handoff or completion path, not supplied-material routing, scope inventory, or the direct-writer choice.

## Validation

- `pnpm --dir sdk/org --filter @lmthing/core test -- src/spaces/prompt-contract.test.ts src/spaces/system-spaces-dag.test.ts` — passed.
- `pnpm --dir sdk/org --filter @lmthing/cli... build` — passed after each source update.
- `pnpm docs:check` — passed: 118 documents, 4,556 citations.
- Prompt-diff literal check found no new scenario-specific terms in `organize_material`; existing Tanzania/Cairo examples elsewhere pre-date this round and were not modified.
- `git diff --check` — passed.

## Remaining failure / next attribution

Do not restore THING's direct app-building path or the direct automator delegation: both were independently proved unsound. The next invocation should trace why an explicit `app-architect#build_app` action emits an outer tasklist yield and then a completed inner `build_app` yield without executing its declared `design`, `create_project`, per-file, and `finalize` nodes. Start at `sdk/org/libs/core/src/delegate/delegate.ts#runDelegate`, `sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`, and `sdk/org/libs/core/src/tasklist/orchestrator.ts#runTasklist`, comparing the action delegate's tasklist envelope/capture behavior with a top-level app-architect invocation. This is now a candidate framework completion/handoff gap, but no L3 change was made because this round did not yet prove which lower-level handoff is missing.

All changes remain uncommitted for human review.
