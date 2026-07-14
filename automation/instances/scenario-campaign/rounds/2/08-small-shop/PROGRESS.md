# PROGRESS — scenario-campaign · task `08-small-shop` · round 2

_Started 2026-07-14T13:03:26.260Z. The agent MUST update this file at every step._

## Steps

- **Oriented.** Read `scenario.md` (14 Acts, 6 sections), `run.mjs` (689 lines, Acts I–XIV wired 1:1),
  `results/report.md`, `results/checkpoint.json`, `fixtures/links.md`. Ran a read-only catalog-scout
  subagent over the scenario + the J–P coverage audit.
- **Round-1 baseline is NOT green — and is worse than the report claims.**
  - `results/report.md`: **❌ FAIL, 16/26 checks**. Only **Act I + Edges** ever executed;
    `checkpoint.json` has `"acts": {}` — **Acts II–XIV have never run**.
  - Act I real failures: the build after "Yes please." **silently no-opped** (50 s, 0 spaces,
    `built:false`, app root **404**) though `system-appbuilder/automator` WAS delegated; both vision
    facts never persisted; `GLZ-TEN-07` never landed; 3 typecheck errors.
  - **NEW FINDING (mine, not in the report): the six ✅ "token landed in REAL STATE" checks are FALSE
    PASSES.** `assertTokenInState` (run.mjs:116) defaults `pathRx = /./` and greps the **whole pod fs
    tree**, which includes the **uploaded fixtures themselves**. That is why six tokens report
    `space-file` in a run where **zero spaces existed**. It was grepping the uploads. Must be scoped to
    `<project>/spaces/**` + `<project>/database/**` + db rows.
  - Error policy in run.mjs contradicts the harness + the campaign spec: it asserts
    `t1.errors.length === 0` / `stats.errors === 0`, but all 3 errors were `attempt:1` = **recovered**.
    `thing.unrecoveredErrors()` (thing.mjs:411) is the right hard check.
  - Live product bug on the frontier: `loadKnowledge('documents/formats/pdf')` etc. **resolve
    `undefined`** — sits exactly on audit item **M**.
- **Target = local.** Harness supports `SCENARIO_TARGET=local` (`lib/local.mjs`). Sibling lanes already
  hold servers on **8080 / 8086 / 8090**; a `restart` kills every lane sharing that port, and I *will*
  need restarts for product fixes → took a **dedicated port 8088** (`LM_LOCAL_PORT=8088`).
- **Local server up on 8088** (`local-server.mjs up` → `http://localhost:8088`).

## Files added to context

- `sdk/org/scenarios/08-small-shop/scenario.md` — the spec: 6 sections, 14 Acts, perf table.
- `sdk/org/scenarios/08-small-shop/run.mjs` — the runner I must extend (Acts I–XIV + hardening).
- `sdk/org/scenarios/08-small-shop/results/report.md` — round-1 verdict (FAIL 16/26, Act I only).
- `sdk/org/scenarios/08-small-shop/results/checkpoint.json` — proves Acts II–XIV never ran.
- `sdk/org/scenarios/08-small-shop/fixtures/links.md` — the 3 real research URLs (Act II seed).
- `sdk/org/scenarios/harness/provision.mjs` + `lib/gateway.mjs` + `lib/local.mjs` — the local-target
  path (`getUser` → `{pod:'http://localhost:<port>', token:null}`; `LM_LOCAL_PORT` for lane isolation).
- `sdk/org/scenarios/harness/lib/pod.mjs` — API surface for the new Acts (`appManifest`/`appData`/
  `fsTree`/`readFile`/`storeSpaces`/`sessionLedger`/`restart` — LOCAL-aware).
- `sdk/org/scenarios/harness/lib/thing.mjs` — `unrecoveredErrors()`, `openAsks()`/`answerAsk()`,
  `didYield`/`didDelegate`/`consentCards` — what the new Acts assert on.
