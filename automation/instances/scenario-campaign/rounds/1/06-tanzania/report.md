# Tanzania scenario report — round 1

## Verdict

**FAIL — step 03 remains unverified.** The scenario reaches real, source-derived spaces and database rows, and the first app-build blocker was fixed at L1, but the generated app is not yet reliable enough to render in a real browser. I stopped after three fresh replays rather than continue layering prompt prose over an unreliable authoring path.

## Evidence

### Initial replay

- Step 01 passed: the turn delegated to `system-vision/vision` and `system-files/{dispatch,reader,sheet}`, cited document/image/audio details, and left `spaceCount: 0`, zero tables, zero pages, and `built: false`.
- Step 02 created four specialists and populated six tables (`action_items`, `contacts`, `cost_line_items`, `itinerary_legs`, `memories`, `park_fee_categories`). It authored four pages, but `built: false`.
- Step 03's runner build was formally successful (`built: true`, four routes, root HTTP 200), but browser evidence showed an empty dashboard. The endpoint manifest contained normalized names such as `itinerarylegsnext` while `pages/index.tsx` called `useApi('itinerary-legs-next')`. The browser loaded no dashboard API calls, because each hook rejected the unknown name before fetch.

A minimal direct authoring probe also made a page and table but left the app unbuilt, showing that a simple direct request could produce source but did not prove the full build workflow reliable. The real-path endpoint-name mismatch is nevertheless an L1 task-template defect: the writer template was converting the route name while the page template correctly treats the route segment as the stable name.

### Verification replay 1

After preserving hyphens in endpoint names, step 03 failed the page build with:

```
components/Badge.tsx: No matching export in @app/runtime for import "cn"
```

This was a second generic L1 authoring-contract issue, not scenario-specific behavior.

### Verification replay 2

After documenting the actual `@app/runtime` import surface, the bundle built (`six routes`, root HTTP 200), but browser evidence failed the app contract:

- the root page displayed `Could not load dashboard data.`;
- its endpoint manifest did not contain `costs-by-category`, although `pages/index.tsx` called `useApi('costs-by-category')`;
- `contacts-list` returned `{ contacts }`, while the page contract expects `{ items }`.

The direct calls to the other dashboard endpoints were 200 and returned real rows; the browser failure was specifically an endpoint-plan / page-wiring mismatch.

### Verification replay 3

After adding generic endpoint-envelope and page-name wiring requirements, step 02 created real spaces and rows but the automator reported zero API routes and zero pages. Its trace includes a duplicate endpoint-name error (`questions` already owned by `api/questions/[id]/PATCH.ts`) and the workflow subsequently resolved without pages or endpoints. Step 03 therefore could not run the app build. This is a third independent symptom of an unreliable free-form plan → per-item authoring workflow.

No replay's build turn emitted `webSearch` or `webFetch`.

## Changes

### L1 — preserve the exact endpoint name

- `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/06-implement_endpoints.md`

Changed the generated endpoint name from a punctuation-stripped route segment to the exact first route segment. General principle: identifiers shared between planned API routes and page consumers must remain identical; a writer cannot silently transform one side of that interface.

### L1 — constrain component runtime imports

- `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/08-implement_components.md`

Added the actual supported `@app/runtime` import surface and prohibited nonexistent class-name utilities. General principle: generated source must only import declared platform exports.

### L1 — make endpoint/page data contracts explicit

- `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/06-implement_endpoints.md`
- `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/09-plan_pages.md`
- `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/10-implement_pages.md`

Specified that read endpoints return `{ items: [...] }`, that a page only calls endpoint names it was actually planned to use, and that those names must be exact route first segments. General principle: plan artifacts are an interface; per-item writers must not invent identifiers or response shapes outside it.

All four prompt edits are domain-neutral. Grep found no scenario literals (`06-tanzania`, personal names, places, booking identifiers, or fixture tokens) in the changed task files.

## Validation

- `pnpm --dir sdk/org test libs/cli/src/app/authoring/lint.test.ts` — PASS (18 tests).
- `pnpm --dir sdk/org --filter @lmthing/cli... build` — PASS after each source update.
- Three clean `--fresh-server --through 3` replays were run. The initial name fix removed the first manifest mismatch; later replays exposed independent generated-output failures as recorded above.

## Attribution and next step

The ledger now records this as the first L1 attempt for step 03, with verification `FAIL`. The evidence shows a systemic reliability problem across endpoint planning, endpoint implementation, component implementation, and final completion—not one scenario phrasing issue. A subsequent round should follow the L2 instruction: trace where the plan/forEach workflow loses or fabricates its cross-node interface, then introduce a deterministic structural validation or enumeration step rather than repeat L1 prose.

No files were staged, committed, stashed, or pushed.
