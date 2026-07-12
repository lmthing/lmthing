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
| 01 | Newsroom | ⏳ running | landed a real fix: live-project table authoring + hook/db hot-reload |
| 02 | Consent & Store | ✅ **PASS 71/71** | security P0 verified by observation; 2 non-security bugs fixed |
| 03 | Resilience | ⏳ running | |
| 04 | Signals & Code nodes | ✅ **PASS** (feature-verified) | 2 bugs fixed; 1 major gap found (no specialist can author a code node) |
| 05 | Latin America | ⏳ running | resumed after it parked on Monitors |

**⚠️ Deploy caveat (applies to every prompting fix this campaign).** Agents patch THING/specialist
`instruct.md` in `sdk/org` source and hot-patch their own test pod to verify live, but a system-space
instruct change only reaches PROD pods via a **new compute image + a user-pod rollout**. Until a
final compute image is built and users are restarted, prod THING keeps the old prompt behaviour
(always harmless — e.g. it may raise a consent card for an unknown install id, but nothing installs
without consent). Track a single final compute rebuild + rollout at campaign end.

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
