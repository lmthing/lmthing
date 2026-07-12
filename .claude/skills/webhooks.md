---
name: webhooks
description: Load when touching the inbound-webhook request flow — the gateway `/api/inbound` broker, the pod `POST /api/inbound/:path` dispatcher, provider verifiers (generic/slack/github HMAC), inbound tokens, per-binding secrets, threading, or prod deploy/verify.
---

# Skill: Inbound Webhooks (the transport + security plumbing)

Applies when you touch the inbound-webhook **request path**: the gateway broker, the pod dispatcher,
signature verification, dedupe, inbound tokens, per-binding secrets, or thread continuity. If instead
you are **authoring** a webhook (an `events/<name>.ts` emitter def + a `{type:'event'}` hook), that is
`@.claude/skills/events-and-hooks.md`; the legacy binding surface is `@.claude/skills/triggers.md`;
plugins riding this same ingress are `@.claude/skills/openclaw-compat.md`.

## Read first — the grounded truth

This file holds **no knowledge**. Everything below lives, cited to code, in:

- `org/docs/cli-api/rest/webhooks.md` — the whole request path: the gateway broker
  (`POST /api/inbound/:userToken/:path`, rate limit, wake, fire-and-forget 202), the pod dispatcher,
  binding resolution (all four sources), the emitter flow vs the legacy flow, verification (built-in
  + descriptor-driven + emitter-def adapters), secret resolution, dedupe, threading, the OpenClaw
  fallback, the full response-code table, and every env var. **Also records a known gap: the GET
  `hub.challenge` branches are unreachable because the route is registered POST-only.**
- `org/docs/format/space/events/webhook.md` — the producer-side format: the `webhook` emitter def
  (`path`, `verify`, `secretEnv`, `challenge`, `emits`, the pure `emit(inbound)`).

Supporting pages: `org/docs/format/space/events/README.md` (the event pipeline) ·
`org/docs/cli-api/rest/hooks.md` (hook routes) · `org/docs/format/project/hooks/README.md` ·
`org/docs/runtime-globals/events-and-integrations.md` · `org/docs/libs/openclaw-compat.md` ·
`org/docs/cloud/routes.md` and `org/docs/cloud/auth.md` (gateway + token posture).

## Procedures

**Run the webhook tests** (from the sdk workspace root — `@lmthing/cli` has **no** `test` script; the
runner is vitest at `sdk/org`):

```bash
cd sdk/org && pnpm vitest run libs/cli/src/server/webhook   # 7 files: inbound, verifiers, threads,
                                                            # dedupe, descriptor, *-dispatch
cd sdk/org && pnpm vitest run libs/cli/src/server/emitter   # emitter manifests
```

**Prod round-trip:**
1. Mint an inbound token — HS256, `sub=<userId>`, `aud="inbound"`, key = base64-decode of
   `GATEWAY_JWT_SECRET` from the `lmthing-secrets` k8s secret. Exact shape:
   `cloud/gateway/src/lib/tokens.ts`.
2. `POST <gateway>/api/inbound/<inboundJWT>/<path>` → expect **202** `{ok,accepted}`; a tampered token
   → 401. The broker is fire-and-forget, so the agent result never comes back on this response — read
   the pod's persisted session snapshot instead.
3. Drive reads **through the gateway** (it wakes the pod); `kubectl exec` fights the idle scaler.

**Adding a provider/verifier:** edit `sdk/org/libs/cli/src/server/webhook-verifiers.ts`, add cases to
`webhook-verifiers.test.ts`, then update `org/docs/cli-api/rest/webhooks.md` in the same change. Prefer
a declarative `VerifySpec` over new per-provider code — the generic engine already covers hmac /
header-equals / body-token / ed25519 / twilio / none.

**Deploy gotchas:**
- New `cli`/`core` workspace deps must be added to `devops/argocd/compute/Dockerfile` — it does **not**
  auto-include `libs/*`. A missing dep crash-loops every pod on `Cannot find package` (this has caused
  a real prod outage).
- Two near-simultaneous pushes race on the devops image-tag bump; the second run's update-manifests
  fails on a rebase conflict. Fix: `gh run rerun <id> --failed`.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the
same change (see `org/docs/SYNC.md`).
