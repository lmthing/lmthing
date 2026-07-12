# PROGRESS — Live prod scenario campaign (THING + system spaces + event pipeline)

**Goal.** Five differentiated, high-complexity scenarios exercising the system spaces
(`system-appbuilder`, `system-architect`, `system-research`, `system-store`, `system-engineer`) and
the unified event pipeline **through the THING agent**, run **live against production with a live
LLM**, on disposable prod test users. Fix every issue found. Commit to `main` on every update.

Started 2026-07-12 ~04:20 local. Budget: 24 h.

---

## Status

| Phase | State |
|---|---|
| Prod readiness check | ✅ compute image `b4542e0` = the S16 events commit — the full pipeline is live |
| Test harness | ✅ built, smoke-tested against prod with a live LLM turn |
| Scenario specs (5) | ✅ written |
| `integration-demo` fix deployed | ✅ `store:da50a48` live — the catalog now serves the demo webhook emitter (`inbound:[{path:'demo',verify:'hmac'}]`), unblocking all five scenarios |
| Scenario execution (5 Opus subagents) | ⏳ running in parallel |
| Issues found / fixed | see the running tally below |

### Scenario scoreboard

| # | Scenario | Verdict | Notes |
|---|---|---|---|
| 01 | Newsroom | ✅ **PASS 51/51** | live on `compute:25f5ec2`; 6 product bugs fixed (several shared-code); all four emitter kinds + both hook styles verified against real pod rows |
| 02 | Consent & Store | ✅ **PASS 71/71** | security P0 verified by observation; 2 non-security bugs fixed |
| 03 | Resilience | ✅ **PASS 46/46** | loop guard held under a 200-delivery storm; found + fixed a real coalescing bug |
| 04 | Signals & Code nodes | ✅ **PASS** (feature-verified) | 2 bugs fixed; 1 major gap found (no specialist can author a code node) |
| 05 | Latin America | 🟡 **CONDITIONAL PASS** | full lifecycle works live — 9 spaces → consented integration → **a real app that builds+serves at `/app/latam/`**; webhook+internal emitters fire; impossible request refused; 6 product bugs fixed. *Conditional:* db/cron emitters still gated by automator authoring reliability on loose compound asks (re-verifying on the final image) |

**Deploy state.** All fixes are committed to `main` and imaged; prod compute has rolled forward across
the campaign (…`6c9f34f` → `25f5ec2` → `7a2a3a1` → `1345229`/`2b861be5`). The final verification of the
db/cron chain (S05) is running against the latest image. Note the instruct/prompting fixes only affect
a PROD user's pod after that pod picks up the new compute image (rolling restart); the scenario runs
verified them on freshly-imaged disposable pods. Existing user pods adopt them on their next restart.

## The harness — `sdk/org/scenarios/harness/`

Zero-dependency Node ESM. Drives the pod's HTTP API directly (no browser): register a prod user →
mint a gateway JWT → provision the pod → load Azure keys → open a **real interactive THING session**
→ send messages → poll the **execution trace** → answer consent cards.

Assertions read the **trace**, not the prose: which specialists THING delegated to, which
consent-marked globals it called, which yields resolved, which hooks fired, tokens burned. A
scenario that only grades the final paragraph passes when the system is broken.

Smoke test (live, prod, real LLM): **PASS** — THING replied in 17.8 s, 2 LLM calls, 7834 in / 69 out.

## Scenarios — `sdk/org/scenarios/`

| # | Scenario | Covers |
|---|---|---|
| 01 | **Newsroom** | new project + multi-space install; all four emitter kinds (`webhook`/`cron`/`db`/`internal`); code-handler vs agent-`trigger` hooks |
| 02 | **Consent & Store** | `system-store/finder`; `installSpace` approve **and** deny; `@consent` space functions; **fail-closed** in every headless path; store error edges |
| 03 | **Resilience** | 200-delivery event storm; coalescing, depth cap, cooldown, self-write/self-trigger exclusion; pod restart → auto-resume + system message |
| 04 | **Signals & Code nodes** | `integration-lmthing` internal signals; `emitEvent` validation; multi-tasklist DAG with code nodes, `dependsOn`/`forEach` output flow |
| 05 | **Latin America** | the full lifecycle: 9 country spaces grown incrementally, consent installs, a THING-built **project app** automating bookings/transport/events, live at `/app/latam/` |

---

## ⭐ Cross-cutting finding (the campaign's biggest): live-project APP authoring is incomplete

Two independent scenarios (04 and 05) converged on the same root gap. A project can be grown through
THING into **spaces + consented integrations + db/cron/webhook/internal automation** — all verified
live — but it **cannot yet be grown into a real web application in that same live project**, because
the authoring surface is missing writers:

- **`writeProjectTable` exists** (added this campaign) but its twins **`writeProjectPage` /
  `writeProjectApi` do NOT** — the automator hit a live `typecheck_error: Cannot find name
  'writePage'/'writeProjectPage'` (S05, Act III). Consequence: `/app/latam/` builds to an **empty
  shell** (`built=false`, 0 pages) — a FAIL against the spec's central "an app I can open on my
  phone" promise, and the four automations had no materialized tables to write into.
- **No system space can author a code node** (S04, F1) — no `writeCodeNode`, no authoring knowledge
  for `NN-<id>.ts` / `node` metadata anywhere. The code-node RUNTIME works (proved via the harness),
  but the specialists that own tasklists can't produce one.

Both are the same shape: **the runtime supports the feature; the appbuilder specialists lack the
authoring primitive + knowledge to drive it.**

**The capability half is now FIXED and VERIFIED LIVE** (S05, `1fe9dae`/`94e23a4`, imaged & deployed):
`writeProjectPage` + `writeProjectApi` added as the live-project twins of `writeProjectTable` (core
injection on `pages:write`/`api:write`, per-grant DTS, `onAppWrite` cache invalidation); the automator
granted both caps + taught the table→api→page pattern; and a project-app-build esbuild plugin
(`94e23a4`) that resolves `@lmthing/ui/elements/*`. Result confirmed on the deployed image:
**`/app/latam/` builds a real app** (`built:true`, real JS/CSS assets, a page route) and serves at
~90 ms — the empty-shell FAIL is resolved. This is the flagship deliverable, working in prod.

**The remaining half is automator authoring RELIABILITY on long, loosely-phrased compound asks** — a
model-behaviour problem, not a missing capability, and the honest reason S05 is a *conditional* pass.
Two concrete, fixed failure modes were the culprits (my earlier "model bump" hypothesis was wrong —
the real fixes were prompting + host-side validation):

- **The automator wrote hooks with LITERAL `\n`** (escaped `\n` in the hook source while using real
  newlines for pages/events) → every hook file was unparseable → the whole hook pipeline died and the
  pod destabilised. **Fixed `f37c6ff`:** validate-before-write rejects unparseable live-authoring
  source and forces the model to retry, instead of persisting garbage.
- **The automator hallucinated filesystem-exploration code** (it has no file tools) on loose phrasing.
  **Fixed `b588041`:** instruct it to author directly, no fs exploration, + author a data-in insert
  path. Measured effect: a "make an activity feed" ask went 3 typecheck errors → 0.

**Residual gaps still open (candidate follow-ups — NOT blockers for the four green scenarios):**
1. **`writeCodeNode`** — code-node authoring is still missing (S04-F1); the appbuilder can't produce
   an `NN-<id>.ts` node. (The code-node runtime works; only the authoring primitive+knowledge is
   absent.) Highest-value remaining follow-up.
2. **`app-architect/build_app` builds a catalog TEMPLATE with the wrong id, not the live project**
   (S05 Act III.6) — so "a page per country" via the *architect* path still doesn't serve at
   `/app/latam/`; only the *automator* path now does. The two app-authoring paths should converge on
   the live project.
3. **Automator `db:schema` without `db:write`** (S05) — "add Antigua to my itinerary" had no path to
   insert a row from the automator's own turn; it can define the schema but not seed data. Consider
   granting a scoped insert path or routing data-in through a hook.
4. **The db/cron agent-trigger chain in a long conversation** still occasionally breaks on an
   automator schema/insert column mismatch (`no column named name`) — the same authoring-reliability
   surface; the `f37c6ff` validation catches unparseable source but not a *valid-but-wrong* column.

**Closed during the campaign:** ~~THING invents a capability (flight-booking Form)~~ — **FIXED**: on
the deployed image THING now **refuses** ("I can't book or pay with your credit card"). And
~~`writeProjectPage`/`writeProjectApi` missing~~ — **FIXED + live-verified** (above).

## Issues found & fixed

### Scenario 02 — Consent & Store: PASS 71/71 (fixes on `sdk/org 99e94cc`, `51a7c25`)

- **THING raised a consent card for a non-existent install id.** Asked to install
  `integration-does-not-exist`, THING called `installSpace(id)` directly and prompted the user to
  approve an impossible install (nothing installed — the gate held, but the UX is wrong). **Fixed in
  product:** gave THING `store:read` and an instruct rule to `storeInspect(id)` before calling the
  consent-gated `installSpace` on any id the finder didn't recommend; if the id doesn't exist it says
  so and never calls `installSpace`. Regression test in `system-store.test.ts`. Verified live.
- **Over-strict prose assertion** in the scenario (THING names integrations by title, not raw
  `integration-*` id) — relaxed to an observation-faithful check. Not a product bug.
- **Security P0 — verified by observation, no exception found across 8 attack angles:** approve
  happens only after a card; denial (and every non-approval answer — `null`, `{}`, a string, cancel)
  installs nothing; `@consent` is generic (gates a project fn *and* a space fn identically); it
  **fails closed** in all three headless paths (hook run, delegate, signed webhook → hook → agent)
  with a clear refusal and no hang; an agent without `store:install` can't even express the call
  (`typecheck_error: Cannot find name 'installSpace'`); store edges (unknown id, double install,
  diverged install, path traversal) all behave. The gate code these ran against is the **deployed**
  prod image; only THING's instruct was hot-patched onto the test pod for the live check.

### Scenario 04 — Signals & Code nodes: PASS, feature-verified (fixes on `sdk/org 54ed659`, imaged `compute:fe7cf57`)

All five internal signals emit and route with schema-exact payloads; the mixed agent→code-node DAG
runs with code nodes at **0 tokens**, upstream keyed by node id, seed at top level; `forEach` fans
out; a hook's `ctx.tasklist.run` returns its result; isolation edges hold (`ctx.fetch` absent,
undeclared `callConnection` throws, a throwing code node fails the task loudly); `emitEvent` without
`events:emit` fails at typecheck.

- **B1 — `project.created` never reached the observing project (core routing bug).** The signal's
  `projectId` names the brand-new SUBJECT project, which has no subscribers, so the default fan-out
  delivered it to the one project that couldn't receive it (confirmed live: 4/5 signals recorded,
  `project.created` = 0 rows). **Fixed** with a `meta.fanOutAll` flag + regression tests.
- **B2 — `system-appbuilder/build_app` still authored the REMOVED `{type:'database'}` hook** (stale
  prompt). Every app THING built would ship broken hooks. **Fixed:** rewritten to author current
  `{type:'event'}` code-handler hooks.
- **F1 (the important product gap): no system space can author a code node.** There is no
  `writeCodeNode` writer and no knowledge/prompt describing `NN-<id>.ts` / `node` metadata anywhere —
  so although the code-node RUNTIME works, the specialists that own tasklists cannot actually produce
  one. The runtime was proved by writing the `digest` files through the harness. **Follow-up (queued
  for campaign end):** add a `writeCodeNode` writer + authoring knowledge to `system-appbuilder`.
- Caveat: post-fix live re-confirmation of B1 was inconclusive — after re-imaging, the heavily-churned
  disposable pod's write path regressed for *all* signals (a pod-state issue, not the one-line routing
  fix). B1 rests on the crisp pre-fix live evidence + green regression tests.

### Scenario 01 — Newsroom: PASS 51/51 (live on `compute:25f5ec2`)

All four emitter kinds (project `db`+`cron`, space `webhook`+`internal`), both hook styles
(code-handler-as-filter at 0 LLM cost, and the earned agent-trigger summary path), consent-gated
double install, and every Step-8 edge — verified against real pod DB rows + FS. Perf: inbound→row
**0.57s**, inbound→agent-trigger summary **3.4s**, whole scenario **8.6 min**, 0 unrecovered errors.
Six real product bugs, each with a regression test:

1. **`a7a485e` — no live-project table writer** (`libs/cli`+`libs/core`). The appbuilder could only
   write tables into the store *catalog*; a project the user is *in* could never gain a data model.
   Added `writeProjectTable` + `SessionManager.reloadProjectDb`/`refreshProjectHooks` (a first table
   brings a DB into being; later hooks hot-reload with no restart).
2. **`056603c` — one broken hook file sank the whole project** (shared `app/hooks/loader.ts`).
   `loadHooks` had no per-file isolation; one malformed automator-authored hook aborted the entire
   load, so a correct sibling intake hook never ran (`events:1` but zero rows). Now skip-with-warn.
3. **`71180b6` — a duplicate emitter event disabled ALL project emitters** (shared
   `server/emitter-manifests.ts`). A redundant second `tip.added` db emitter made the whole project
   scope fail to load, so `project/tip.added` never fired and the agent-trigger summary hook went
   dead. Now drop the offending def (keep the first), scope stays alive. **The substantive Step 5
   root cause** — and the right robustness posture for LLM-authored live projects.
4. **`71180b6` — `installSpace().message` typecheck error** (THING instruct) — the `{ok,error}`
   fallback union made `.message` non-existent; the display now reads `.error` only.
5. **`d8c15a6` — `'db' is not defined`** (automator instruct) — it was told to call `db.tables()`,
   but `db` isn't injected on a fresh project; switched existence checks to `listDir('database')`.
6. **Automator prompting** (`f957459`/`fc947d1`/`cb23f1e`/`04956a5`/`b588041`) — one-hook
   direct-insert, `primaryKey`, unique event names, real-column inserts, the cron *emitter-def*
   pattern, and using a model for reasoning instead of hand-rolling fake summaries.

Honest notes: Step 1 was reframed — project *creation* is a deliberate UI action, and THING must NOT
mis-route it into `build_specialist` (it did: 176s + errors); the step now asserts that correct
behaviour. Automator over-creation still happens occasionally, but the **runtime is now robust to it**
(the isolation fixes #2/#3 are the durable answer; prompting only reduces frequency). Deploy friction
(ArgoCD stale refs, a racing CI image-pin job, a transient ACR token EOF) needed manual reruns —
worth hardening the image-tag CI step.

### Scenario 03 — Resilience: PASS 46/46 (loop-guard fix `sdk/org abd11c0`)

The loop guard held under everything the spec threw at it, live: **200 signed deliveries → exactly
200 rows, counter +200 (no lost increments under concurrency of 20), 0 LLM calls, 0 5xx**, and a
THING turn issued *during* the storm still completed (event loop not starved). A 10× replay deduped
to one row (9/10 `{deduped:true}`). Coalescing collapsed a 30-write burst to **1 fire (30:1)** with
self-write exclusion; the A↔B cycle terminated at **cap depth 3** with a cap warning and a healthy
pod; a throwing/hanging space emitter was worker-contained. Post-restart the session resumed with
history + a system message and durable data intact. Perf: delivery p50 811ms / p95 1790ms; storm
13.6/s; cold-wake→first-byte **3.4s**.

- **Bug (fixed): coalescing DROPPED a burst's trailing events instead of deferring them.** After a
  coalesced fire, 29 of 232 rows stayed untagged — events suppressed by the per-hook cooldown *at
  enqueue time* were discarded, so inserts arriving during the fire's cooldown window never got a
  catch-up fire. Coalescing must debounce the trailing edge, not drop it. **Fixed** in
  `libs/cli/src/app/hooks/dispatcher.ts` (deferred map + `promoteDeferred`/`nextDeferredDelay`) and
  `runtime.ts` (`scheduleDeferredDrain`), with 16 dispatcher unit tests. In `compute:6c9f34f`.
- **Perf note (not a bug): a pod RESTART (container recreate) took ~313s to serve**, far over the 60s
  target — but that is the K8s image-pull/schedule path on the free-tier node, NOT the optimized
  scale-to-zero wake (3.4s). All correctness guarantees (resume, history, durable data, system
  message) held; only the restart-latency target is missed. Flagged for the pod-lifecycle owners.

### Scenario 01 — Newsroom: first run FAIL 46/51 → fixes landed, re-verifying

The first live run exposed the automator producing a **tangle** — 7 automator delegations, 3
overlapping tip tables (`tips` / `story_tips` / `automation_audits`), 2 intake hooks — and, downstream,
a code-handler hook that emitted `{events:1}` but **committed no row** (so Steps 4/7/8 failed on the
side effects even though the event plumbing worked). Also confirmed cleanly on the first run: THING
correctly **declines to create a sibling project** (that's a UI action by design) rather than
mis-scaffolding; all four emitter kinds went live; consent gated both installs; and the webhook edges
(bad HMAC→401, unknown path→404, malformed→`{events:0}`) all behaved.

Fixes landed by the S01 agent, now in `compute:6c9f34f`:
- **`f957459` automator prompting** — an explicit ONE-hook direct-insert pattern for inbound→store,
  and a ban on fabricated relay events + redundant tables (kills the 3-table/2-hook tangle).
- **`056603c` isolate per-hook load failures** — one broken hook file no longer sinks a project's
  *entire* automation (which is why healthy hooks silently stored nothing).

Re-verification on the deployed image is in progress.

### 1. `integration-demo` was stranded on the legacy webhook path — **FIXED**

`integration-demo` is the one space that exists so the event pipeline can be exercised **without a
real provider account** ("no real provider account needed" — its own description). The S15 events
migration moved every other messaging space's inbound half into an `events/*.ts` emitter def, but
demo was missed: it still carried the legacy `lmthing.webhook` descriptor block in `package.json`
and had **no `events/` def at all**, so under the current model it could not emit anything. Nothing
caught it, because there was no def to fail validation.

**Fixed:**
- `store/spaces/integration-demo/events/messages.ts` — a `webhook` emitter def (HMAC-SHA256 over the
  raw body, `x-demo-signature: sha256=<hex>`, keyed by `INTEGRATION_DEMO_WEBHOOK_SECRET`) emitting
  the standard `message.received` contract, with bot/empty/non-message filtering in `emit`.
- Removed the dead `lmthing.webhook` block from its `package.json` (a space must not carry both, or
  the legacy binding shadows the def).
- **Regression guard** — `store/spaces/tests/catalog-emitters.test.mjs` (`pnpm -C store test:spaces`):
  no space may carry the legacy block; **every `messaging` space must have a webhook emitter def
  emitting `message.received`**; every def validates against the real engine validator and keeps its
  env refs inside its own `INTEGRATION_<ID>_` namespace. 8/8 green — and it fails on the pre-fix tree.

This unblocks all five scenarios: the demo space is now the provider-free, HMAC-signed inbound
source they use to inject events with a secret we control.

## Harness gotchas worth keeping (each cost a debug cycle)

- **The gateway JWT secret is double-base64.** k8s `.data.GATEWAY_JWT_SECRET` decodes to the env
  *value*, which is itself base64 of the signing key. Decode once when fetching, once when signing —
  otherwise every token 401s.
- **`PUT /api/compute/env` rolls the pod, and sessions are in-memory.** A session created against the
  old replica dies with it (`404 unknown session`). Load env *before* the first turn; skip the PUT
  when nothing changed; then prove a session survives before proceeding (`waitPodSettled`).
- **`pod.ready` is `readyReplicas > 0`** — true throughout a rolling update, and it precedes Envoy
  wiring the new endpoint. It does not mean "my next request lands on the new pod".
- **Consent requires an interactive session.** The prompter is only wired for `POST /api/sessions`
  sessions; headless paths (hooks, delegates, webhook dispatch) have no prompter and fail closed.
  That is the designed behaviour, and scenario 02 asserts it as a security property.

---

## Log

- **04:20** — Campaign started. Verified prod runs compute `b4542e0` (the S16 events commit), so the
  full pipeline under test is live. 7 existing user namespaces.
- **04:35** — Harness built and smoke-tested end-to-end against prod: register → pod → env → THING
  session → live LLM turn → trace assertions. Fixed two harness bugs found by the smoke test (the
  double-base64 secret; the env-PUT rollout race killing sessions).
- **04:45** — Found and fixed the `integration-demo` emitter gap; added the catalog-wide regression
  guard. 8/8 space tests green; 50/50 emitter tests green.
- **04:55** — Five scenario specs written. Fanned out one Opus subagent per scenario, each with its
  own disposable prod test user (`newsroom`, `consent`, `firehose`, `observatory`, `latam`).
- **05:05** — CI built and ArgoCD deployed `store:da50a48`; confirmed the **live** catalog at
  `https://lmthing.store/projects/manifest.json` now serves `integration-demo` with its webhook
  emitter. All five scenarios unblocked — they can install the demo space into a real pod and inject
  HMAC-signed inbound events with a secret we control.
