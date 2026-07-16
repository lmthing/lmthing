# Tanzania round 2 report

## Verdict

**Step 02 failed; not fully verified.** Step 01 passed in both replays. The initial step-02 blocker — TS7006 on `plan_tables.tables.find(t => ...)` — was fixed at the framework layer and its regression tests pass, but the clean verification replay still left the app build status at `false` for separate generated-code errors. I stopped after the second failed scenario replay, per the one-failure/couple-of-tries limit.

## Attribution

The first replay's `step-02.full.json` recorded two `fork:implement_endpoints` TS7006 failures on callbacks over `plan_tables.tables`, and the manifest was `built: false`. The attempt ledger already records three unsuccessful L1 edits to the appbuilder task instructions. The endpoint instruction already provides a safe array-index template, but the model still emitted its own `.find(t => ...)` setup statement.

The direct cause was structural: task forks declared every upstream output as `any` in `ForkEngine`, while task output metadata knows `plan_tables.tables` is an array. Under strict typechecking that leaves the callback parameter implicit `any`. Prompt prose cannot give this value a TypeScript type, so L1/L2 cannot deterministically prevent this class of error.

## Changes

### L3 — typed upstream task outputs

- `sdk/org/libs/core/src/fork/fork.ts#taskOutputDts`
- `sdk/org/libs/core/src/tasklist/orchestrator.ts:131-135`

The orchestrator now threads each dependency's declared top-level output schema into the fork. `taskOutputDts` produces ambient declarations from that schema: known array fields are `any[]`, so array callbacks infer a parameter rather than failing TS7006; untyped/unknown fields remain `any`.

The same fork ambient now gives host-injected `forEach` `item` a record-with-array-fields type. This avoids the equivalent TS7006 when generated pages map an item array.

**Why L3:** the exact model statement has to typecheck before it can call any writer. The current task schema was discarded at the fork boundary (`declare const <dependency>: any`), and no tasklist frontmatter or prompt can alter the compiler declaration. This is an ambient-DTS propagation gap.

### L3 regression tests

- `sdk/org/libs/core/src/fork/fork.test.ts` — added coverage for a declared upstream array callback and a `forEach` item callback.

`pnpm -C sdk/org test libs/core/src/fork/fork.test.ts` passes with 23 tests. I temporarily restored the old `any` declarations twice; each corresponding new test failed by salvaging `{ found: false }` or `{ count: 0 }`, then passed again after restoring the patch. `pnpm -C sdk/org exec tsc --noEmit -p libs/core/tsconfig.json` also passed.

### Documentation

- `org/docs/runtime/fork-and-tasklists.md` — documents schema-derived ambient types for upstream outputs, with grounded anchors.

`pnpm docs:check` passed: 118 docs and 4,606 citations resolve.

## Scenario evidence

### Initial failure

`step-02.json` from the initial replay:

- Three specialist spaces and 24 seeded rows were present.
- `appManifest.built` was `false`.
- `fork:implement_endpoints` reported `Parameter 't' implicitly has an 'any' type.` for `plan_tables.tables.find(t => ...)` twice.
- No web-search yield occurred.

### Verification replay

The clean `--fresh-server --through 2` replay passed step 01 again (vision/files delegates, no state authored before the offer). Step 02 no longer contained the initial `plan_tables.tables.find(t => ...)` TS7006 error, confirming the upstream-output portion of the framework fix reached the local server.

It still failed the app-build expectation: six real tables and seven pages were written, but `appManifest.built` remained `false`. Its independent diagnostics were:

- `fork:implement_tables`: `console` is absent from the strict sandbox DTS.
- `fork:implement_components`: orphaned `as const;` statements.
- `fork:implement_pages`: `Parameter 'c' implicitly has an 'any' type.` from mapping `item.components` (the second ambient typing fix was added after this replay and is regression-tested, but not scenario-rerun).
- `fork:implement_pages`: malformed generated string source.

Because those latter errors are independent model-authoring/runtime reliability faults, the full step is still a **FAIL**. The app was therefore not browser-verified.

## Scope / overfitting

No system-space prompt was changed. The framework and documentation changes contain no persona, fixture, table, or scenario-domain literals; there is no scenario-specific prompt guidance to grep. All changes remain uncommitted.

## Commands run

- `pnpm -C sdk/org test libs/core/src/fork/fork.test.ts` — PASS (23 tests)
- Revert proof for each new regression test — FAIL as expected, then restored
- `pnpm -C sdk/org exec tsc --noEmit -p libs/core/tsconfig.json` — PASS
- `pnpm -C sdk/org --filter @lmthing/cli... build` — PASS
- `pnpm docs:check` — PASS
- Fresh local scenario replay through step 02 — still FAIL as described
