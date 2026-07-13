# PROGRESS — scenario-campaign · task `06-tanzania` · round 1

_Started 2026-07-13T19:45:55.831Z. The agent MUST update this file at every step._

## Steps

- **Oriented.** `sdk/org/scenarios/06-tanzania/scenario.md` is fully authored (6 sections, 14 Acts,
  5 real fixtures already committed: md + jpg + pdf + xlsx + mp3). `run.mjs` did NOT exist → round-1
  job is to implement it 1:1 from the spec, not to re-author the story.
- **Verified the fixture tokens are real & disjoint** — dumped `trip-costs.xlsx` (2 sheets: `legs`,
  `costs`; the grand-total cell really is `3344.2`), read `voice-memo.txt` (Emmanuel + the
  5,000-shilling ranger tip), `tanzaniamemories.md` (flight ref `ZZJQUU`), `links.md` (the 92-day
  Zanzibar-insurance validity window — the research target, in no fixture).
- **Checked the product surfaces each Act asserts on** before writing them: `db.query`'s `include`
  (`libs/cli/src/app/store.ts` `expandIncludes`), the api `HttpError` contract + worker crash
  boundary (`libs/cli/src/app/api/errors.ts`, `worker.ts`), file-based api routing (`api/<route>/GET.ts`,
  `loader.ts`), `@app/runtime` handler imports (`handler-module.ts`), `fork_queue` trace events
  (`libs/core/src/fork/fork.ts:170`), relation schema (`libs/core/src/db/schema.ts`), and the space-file
  REST route (`GET /api/projects/:id/spaces/:sid/files` → `Record<path,content>`) used for the
  "token landed in a space file" assertions.
- **Wrote `sdk/org/scenarios/06-tanzania/run.mjs`** — all 14 Acts, 1:1 with the spec's Acts table.
  Keeps every hardening pattern: per-Act checkpoint + `--acts=`, keepalive pinger, resilient send
  (survives a pod roll), scripted `onAsk` (consent approved, any other ask settled with `{}`),
  trace/real-state-only assertions. The real-state helpers read db rows AND every project space file,
  so a fixture token is proven where it was actually written, never in prose. Syntax-checked.

- **Resumed (attempt 2).** Re-oriented: `run.mjs` is committed (sdk/org `053d6cc`), 14 Acts, but
  `results/checkpoint.json` showed **zero Acts passed** — the previous attempt died before running
  anything live.
- **Proved prod healthy** — `node smoke.mjs`: pod reachable, store catalog 13 spaces, a real THING
  turn completed in 10.8s with 0 eval errors.
- **Wiped a contaminated project before running Act I.** The cached `06-tanzania` user's
  `tanzania-trip` project already held a **half-built app** (tables `accommodations`, … from the
  interrupted run) with **no spaces and no sessions**. Asserting fixture tokens against pre-existing
  rows would have been a fake green → `pod.deleteProject('tanzania-trip')` + cleared the checkpoint so
  Act I ("no authoring before consent") starts on a pristine project.

- **BASELINE RUN (Acts I–II) — FAIL, and the finding is big.** THING ingested all five files
  perfectly (`system-vision` + `system-files/dispatch` → `reader` + `sheet`, `readDocument` ×3, no
  premature authoring) and then **did nothing at all**: no offer, no spaces, no app. A bare
  "Yes please." (23s) and even an explicit nudge ("Is it ready?", 33s) produced **0 tables, 0
  spaces**. Its final reply to the user was `display("24872")` — a bare character count — after
  hitting `Cannot find name 'fullSummary'` (variables don't persist between evals).
- **Triaged to THREE prompt bugs in THING's judgment (no code bug):** (1) the instruct teaches only
  RESTRAINT ("only reach for path 4 LATER, when the user actually asks") and never tells THING to
  **propose** — so it is never asked, because the user doesn't know an app exists; (2) per-topic
  spaces are only ever built when the user *explicitly asks* for them; (3) nothing says the LAST
  `display()` is the only thing the user reads. Root cause behind (3): THING asks system-files for
  "EVERY detail / exhaustive extraction", drags the whole document into its own context, and the
  giant binding is gone by the next statement.
- **Fixed all three as GENERAL principles** in `user-thing/agents/thing/instruct.md` (zero
  scenario-specific strings): offer-then-wait + a bare "yes" to its own offer IS consent · distinct
  parts of the material get their own spaces on THING's judgment · never end a turn on a raw
  artifact · (4th, added after the same trap repeated) **read to ORIENT, not to COPY** — carry a
  summary, pass the attachment id to the automator.
- **Test:** `libs/core/src/spaces/system.test.ts` loads the SHIPPED `user-thing` space and pins all
  four promises + the restraint they counterbalance. **Verified it FAILS on the old instruct** and
  passes on the new one (not a tautology). Committed sdk/org `11a9396`.
- **Hot-patched the pod** (`PUT /api/projects/system/spaces/user-thing/files/agents/thing/instruct.md`
  + restart, read back OK), wiped the project, re-ran Acts I–II live.
- **Act I now PASSES (5/5)** — before: `offered=false`, 0 specifics, reply `"24872"`; after:
  `offered=true`, **4** of his own specifics cited, still zero authoring before consent.

- **Act II now largely PASSES** (was: nothing at all). The bare "Yes please." now builds: **7 tables,
  96 seeded rows** (itinerary 35, cost_items 22, costs 14, park_fees 11, field_notes 10, contacts 2,
  photos 2), **4→6 pages**, 6 endpoints, `pages/_layout.tsx` **with the `<Chat>` dock**, the
  provided-info shortcut honored (**1** incidental web yield), 0 unrecovered errors, build turn 534s.
  Remaining gap: only **2** per-topic spaces (`tanzania-safari-qa`, `zanzibar-advisor`) — Cairo/Dar
  skipped, so the ≥3 check still fails.
- **THE OVERFIT FINDING (the big one).** `system-appbuilder/agents/automator/instruct.md` shipped
  with **this scenario's own fixture data in its examples** — the booking ref **`ZZJQUU`**, flight
  `A3932`, "Eileen Hotel", the `$960` balance. Act III asserts "`ZZJQUU` landed in a db row" *to
  prove THING actually read the attached file* — but an agent with `ZZJQUU` in its own system prompt
  can emit it having read nothing. A previous round taught the agent the answer key, which
  invalidated the exam. **Scrubbed every token** (examples are now domain-neutral orders/line-items)
  and added a CI guard that walks **every** shipped agent for scenario fixture tokens (verified it
  FAILS against the pre-scrub automator).
- **Two more appbuilder gaps, both fixed as general principles + tests** (sdk/org `ca816f7`,
  `bb5f623`): (a) **not one declared relation** across 7 tables → `db.query({include})` (shipped,
  typed, documented) had nothing to expand; the format was in knowledge but nothing said *when* to
  use it. (b) **not one shared component**, though the automator holds `writeProjectComponent`.
  (c) it **dropped the figures the source itself states** — the xlsx's grand total and the PDF's
  emergency hotline never became data, though 36 cost rows and 11 fee rows did.
- **`api:call` was dead code in production** — the global, its DTS, its typed per-project overloads
  and the fork-intersection all existed, granted to **no shipped agent**; and the `{allow:[…]}` list
  (documented as *the* security boundary, "there is no call-anything") was **never checked at the
  call site**. Fixed both: enforced in the yield router (resolver never runs for a refused endpoint,
  threaded from the agent's own grant by session AND delegate), added the documented `["*"]` wildcard,
  granted THING `api:call: {allow:['*']}` + the "ask the app, don't re-derive" principle. 3 new
  router tests; 757/757 core green; `org/docs` updated in the same change (the stale "re-checks no
  allow-list" sentence was literally documenting the hole). sdk/org `0a99b59`, parent `650d3f1f`,
  **compute:650d3f1 built green in CI**.
- **Acts III/IV live:** ✓ `ZZJQUU`, ✓ `Emmanuel`, ✓ the 5,000-shilling ranger tip all in **real rows**
  (audio transcription + md proven); ✗ xlsx total `3344.2` and ✗ the PDF hotline never persisted
  (both files *were* read — 36 + 11 rows — but their headline facts were dropped → the `bb5f623` fix);
  ✓ app compiles + serves 200 real HTML with 6 pages; ✗ no relation (pre-fix build, expected).
- **Fixed a HARNESS false-negative** in Act III: the vision check read `thing.events` (in-memory),
  but Acts III+ run in a **new process** that resumed the session and never streamed Act I's turn →
  `didDelegate('system-vision')` was always false. Now asserts the photo's description **in real
  state** (db rows + space files) — strictly stronger: a text model cannot describe a picture it
  never saw.

- **Acts V–X live (all real product bugs, all fixed as general principles + tests):**
  - **Act V FAIL — it guessed instead of checking.** 0 web yields. THING routed the Zanzibar-insurance
    question (in NO fixture) to the `zanzibar-advisor` space **it had just built from those same
    files** — which cannot know it. → THING now asks "was this in what they gave me?", researches when
    not, escalates when a space says it doesn't know, and KEEPS the finding (`e1620bd`).
  - **Act VI FAIL — 0 `apiCall` yields** (root cause found pre-emptively: granted to no agent + the
    allowlist never enforced; both fixed, THING now holds the grant — it still chose not to call).
  - **Act VII PARTIAL — but a coverage-audit FIRST landed:** ✗ no engineer delegate (0 explore/plan
    forks), **✓ the fork concurrency cap + queue hold live — 70 `fork_queue` events, `max=4`,
    over-cap=0, peak `queued`=1**, and no runtime write-failure inside any read-only fork.
  - **Act VIII FAIL (blocked)** — the throwing route returned 200 HTML: the app's own API is
    unreachable over HTTP entirely (see the issue). The pod DID survive and kept serving.
  - **Act IX PARTIAL** — ✓ `types/generated.d.ts` + compiles; ✗ zero components.
  - **Act X FAIL — it mistook orienting for answering.** ✓ the `<Chat>` dock is on every page; ✗ the
    in-app request added nothing in **8s** — in a fresh session THING ran its orientation read and
    **displayed the project structure as JSON** instead of routing the request (`e1620bd`).
- **A2 BROWSER PASS (chrome-devtools, live prod) — THE APP OPENS BLANK.** Session injected on both
  origins; `https://lmthing.app/tanzania-trip/` → the served HTML requests its bundle at
  **root-absolute** `/assets/index-C6zkfNfK.js` → **404**, while the same asset exists at
  `/tanzania-trip/assets/index-C6zkfNfK.js` → **200**. JS *and* CSS 404, React never mounts, a11y tree
  is a bare `RootWebArea`. The app's **own API is unreachable at every candidate URL** too
  (`/<project>/api/…` → HTML shell; `/api/…` → 404) because `resolveAppBase` needs an `/app/<id>/`
  segment the clean-URL host lacks and the documented `__APP_BASE__` hatch isn't injected. **The raw
  data API returned all 35 rows the whole time** — exactly the trap the campaign warns about. Filed
  `.issues/served-app-renders-blank-asset-404.md` (parent `b590aab0`); NOT fixed (serving-layer, out of
  this round's budget) — recorded honestly.
- **Shipped:** sdk/org `40f92d8`, parent `1c15afea` (CI building `compute:1c15afe`). Earlier code fix
  already verified green in CI as `compute:650d3f1`.
- **Wrote the honest round-1 verdict into `scenario.md` §Actual results:** FAIL, with the per-Act
  table, all 9 fixes + shas, the 2 open issues, and the performance numbers.

- **Acts XI–XIV finished live.** XI: ✓ **the Greek message changed a real row** (`ZNZ-PERMIT-77`),
  ✓ no payment side-effect, ✓ no fabricated "sent!" — ✗ but the refusal never reached the user: the
  final reply was **`## Todos`** (same "turn ended on machinery" family → strengthened the rule,
  `2d8e9fd`). XII: ✗ no `user-memory` delegate, ✓ **a brand-new historyless session still recalled the
  standing preference** (promise holds; the assertion is narrower than the promise). **XIII: PASS** —
  restart → auto-resume, **2 spaces + 97 rows survived**, app still compiles.
- **Act XIV was FAKING ITS OWN PASS** — the one Act that exists to check the layer the user sees. It
  read `e.pattern` (the field is **`routePath`**) → every probe collapsed to `/api/` → the SPA fallback
  answered → and a `body.length > 20` check called that "real data". It was the HTML shell. Fixed to
  demand real JSON + to resolve the shell's bundle **exactly as a browser does**; it now fails honestly
  on all 5 app routes and **reproduces the blank-app bug with no browser** (`9f92d6d`).
- **DEPLOY VERIFIED LIVE.** `compute:1c15afe` built green in CI → `kubectl set image` on the test pod →
  **rollout succeeded**, pod runs `lmthingacr.azurecr.io/compute:1c15afe`, the app survived the roll
  (7 tables), and the shipped prompts carry every fix (api:call grant, propose/consent, last-display,
  automator relations/components, **zero fixture tokens**). The `api:call` enforcement's negative path
  is covered by 3 unit tests (a live negative needs an agent with a narrow allowlist; THING holds
  `['*']`).
- **Shipped:** sdk/org `9f92d6d`, parent `40a6bf3b`. 10 product fixes, each with a test; 2 open issues
  recorded honestly. **Round verdict: FAIL** — a green baseline was NOT reached, and that is the
  truthful result.

## Files added to context

- `sdk/org/scenarios/06-tanzania/scenario.md` — the spec the runner must implement 1:1.
- `sdk/org/libs/cli/src/app/runtime/client.ts` (`resolveAppBase`/`baseOverride`/`apiCall`) and
  `libs/cli/src/app/build/pages.ts` (`renderIndexHtml` — emits RELATIVE `./assets/` URLs by design,
  which is how I proved the served shell is NOT the one the builder produced) +
  `libs/cli/src/server/routes/app-api.ts` (the api is mounted at `/app/<project>/api/*`) — the three
  files that together explain the blank-app / unreachable-API bug.
- `sdk/org/libs/core/system-spaces/system-appbuilder/agents/{automator,data-modeler}/instruct.md` —
  where the overfit fixture data lived, and where the relations/components/stated-figures gaps were.
- `sdk/org/libs/core/system-spaces/system-appbuilder/knowledge/app_building/model/file-formats.md` —
  the `relations` FORMAT was documented all along; only the *when* was missing.
- `org/docs/format/space/agents/capabilities.md` — the doc that explicitly recorded the
  un-enforced-allowlist hole ("the yield router … re-checks no allow-list"); updated to the opposite.
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — THING's triage brain; the
  propose/consent + last-display + read-to-orient gaps live here.
- `sdk/org/libs/core/src/spaces/system.test.ts` — the existing "assert on the SHIPPED spaces" test
  seam; where the prompt-contract regression test went.
- `sdk/org/libs/core/src/spaces/{system.ts,load.ts}` — `loadSystemSpaces` → `Space.agents` is a
  `Record<slug, AgentDef>` and the prompt body is `instructBody` (needed for the test).
- `sdk/org/libs/core/src/spaces/capabilities.ts` + `exec/{bootstrap,capability}.ts`,
  `eval/yield-router.ts` — the `api:call` grant path (Act VI): the machinery exists but **no shipped
  agent declares `api:call`**, and the required `{allow:[…]}` list is parsed/validated yet **never
  enforced at call time** (the DTS is what actually gates it).
- `sdk/org/scenarios/harness/lib/thing.mjs` — where "session entered error state" comes from (the
  pod marking `status:error`, not a harness artifact).
- `sdk/org/scenarios/harness/provision.mjs` (`getUser`/`loadUser` — cached-user reuse semantics) and
  `harness/lib/pod.mjs` (the `deleteProject`/`appManifest`/`appData` surface used to inspect + wipe
  the stale project).
- `sdk/org/scenarios/06-tanzania/fixtures/links.md`, `tanzaniamemories.md`, `voice-memo.txt` — the
  unique tokens each Act must find in real state.
- `sdk/org/scenarios/_template/run.mjs` — the hardening baseline to start from.
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs`, `provision.mjs`, `lib/paths.mjs` — the API
  the runner drives (uploads + mediaType routing, WS attachment path, trace-derived turn facts).
- `sdk/org/libs/cli/src/app/api/{errors,loader,handler-module,worker}.ts` — the crash-boundary + route
  contract Act VIII asserts.
- `sdk/org/libs/cli/src/app/store.ts` (`query`/`expandIncludes`), `libs/core/src/db/schema.ts` — the
  `include` relation feature Act IV asserts.
- `sdk/org/libs/core/src/fork/fork.ts` — the `fork_queue {active,queued,max}` events Act VII asserts.
- `sdk/org/libs/cli/src/server/routes/{projects,fs}.ts` — the file/space read routes the real-state
  helpers use.
- git history `4587aee^:scenarios/06-tanzania/run.mjs` — the pre-rewrite runner, for the hardening
  patterns it had already learned.
