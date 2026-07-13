# PROGRESS — scenario-campaign · task `10-family-recipes` · round 1

_Started 2026-07-13T09:34:01.809Z. The agent MUST update this file at every step._

## Steps

- **Orient.** Read `scenario.md` (fully authored: persona, flow, contract, choreography, 11 user
  stories, Acts I–VII + Edges) — but **no `run.mjs` existed**, so round 1 = scaffold the runner from
  the 09 sibling + harness, reach a green baseline, then add the first new Acts.
- **Inspected the fixtures for real content** (assertions must be grounded): `recipe-card.jpg` is a
  real photo of a **handwritten cursive "Orange Cake" card** (English, NOT Greek — the spec claimed
  Greek OCR); `recipe.pdf` is a real printable **"Easy Lasagna"**; `recipes.md` carries the Greek
  seed tokens; **there is no voice-memo fixture** → the audio beat cannot be honestly asserted.
- **Wrote `run.mjs`** (Acts I–VII from the table 1:1 + Edges), keeping every hardening pattern from
  the campaign spec: per-Act checkpoint + `--acts=`, keepalive pinger, resilient send (cold-wake /
  session-lost / error-state), scripted `onAsk`, signed-inbound helper, live-app assertions. Greek
  matching is stem+NFC-normalized so declined forms still count.
- **Added the FIRST batch of NEW Acts (3)** from the feature catalog — capabilities scenario 10 did
  not cover — extending the same persona naturally:
  - **Act VIII — Remember me** (`user-memory`): a "remember forever" household rule (half mint; Nikos
    eats aubergines roasted, never fried) → asserts the memory route + **recall in a later unrelated
    cooking turn**.
  - **Act IX — Consent DENIED** (the half of consent that must fail closed): he asks for
    `integration-telegram`, then **denies** the card → asserts the space is **absent from disk**, the
    other spaces survive, and THING says it did not install it.
  - **Act X — Engineer-authored code** (`system-engineer`): "400γρ αρακά" vs "1 φλιτζάνι αρακά" count
    as different things → a unit-aware merge helper must land as a **REAL file** in the project; the
    app still compiles and the list still de-duplicates (no regression).
- **Updated `scenario.md` 1:1** with the runner: new flow steps 11–13, expectations 11–13, US-12/13/14,
  Acts VIII–X in the Acts table, feature checklist ticks, perf targets — and **corrected the fixture
  claims honestly** (the card is English, not Greek; audio is NOT exercised, no fixture).
  Also split the channel-ping assertion out of Act IV into Act VI, where the integration actually
  exists (no connection is installed at Act IV — asserting a ping there would have been a lie).

## Files added to context

- `sdk/org/scenarios/10-family-recipes/scenario.md` — the spec being implemented + extended.
- `sdk/org/scenarios/10-family-recipes/fixtures/{recipes.md,recipe-card.jpg,recipe.pdf}` — to ground
  the ingest assertions in what the files ACTUALLY contain (card = "Orange Cake"; pdf = "Easy Lasagna").
- `sdk/org/scenarios/09-home-renovation/run.mjs` — the closest sibling runner; the source of the
  hardening patterns (checkpoint/resume, resilient send, keepalive, scripted asks, signed inbound).
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs`, `harness/provision.mjs` — the harness API
  (what can be asserted: `appManifest/appData/appBuild/listSpaces/fsTree/inbound/runHook`, the trace).
- `sdk/org/scenarios/09-home-renovation/results/report.md` — what a passing sibling run looks like.
- `sdk/org/libs/cli/src/server/routes/app-admin.ts` — the real app-manifest shape
  (`{tables,pages,endpoints,hooks,build}` — there is no `functions` key, so Act X asserts on the fs tree).
- `store/spaces/` listing — to pick a real, uninstalled store space for the Act IX denial branch.
