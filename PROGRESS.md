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
| Issues found / fixed | 1 found, 1 fixed (see below) |

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
