# Serverless Free-Tier Compute Pods — PROGRESS

Single source of truth for this change set. Plan: `~/.claude/plans/with-all-that-context-validated-sky.md` (approved 2026-07-06).
Previous effort (Reliability Rethink, P0–P7 done 2026-07-02) archived in git history of this file.
Mode: autonomous / non-stop. Commit target: **main** (user-authorized). Test: real logged-in user in chrome-devtools.

## Shared pod↔gateway contract (single source of truth)

Auth: scoped **compute JWT** (`aud:"compute"`, `sub:userId`), HS256 with `GATEWAY_JWT_SECRET`.
Injected into `user-env` as `LMTHING_COMPUTE_JWT`. Pod sends `Authorization: Bearer <jwt>`.

Endpoints (pod → gateway, verified by `verifyComputeToken`, NOT authMiddleware):
- `POST /api/compute/self-idle`   body: `{ idle: boolean }` → idle:true scales caller's pod to 0
  (race-guarded ~30s); idle:false = heartbeat that refreshes the last-active backstop clock
- `POST /api/compute/cron-manifest` body: `{ jobs: [{ projectId, slug, cronExpr, everyMs, nextRunAt }] }`

Env injected into pods (GET-merge-PUT, never clobber):
- `LMTHING_COMPUTE_JWT`, `LMTHING_SELF_IDLE=1`, `NODE_OPTIONS=--max-old-space-size=<~60% memLimit>`
- (already present) `LMTHING_GATEWAY_URL`, `IDLE_TTL_MINUTES`

Deployment annotation: `lmthing.cloud/last-active` (RFC3339) on Deployment **metadata**.
Node pool: label `lmthing.cloud/pool=user`, taint `lmthing.cloud/pool=user:NoSchedule`.

## Status legend: pending · in-progress · done · deferred/blocked

| Phase | Scope | Status | Notes |
|----|-------------|--------|-------|
| P0 | Recon — anchor files, exact signatures & line anchors | done | |
| P1 | Scale-to-zero (self-idle + gateway sweep) | code done | gateway+cli typecheck clean; unit-tested; local-smoke inert |
| P2 | Externalized cron (manifest + gateway wake) | code done | nextRunAt daily-fix unit-tested; cron.test 18/18 |
| P3 | Burstable + memory watchdog | code done | evictOneIdle unit-tested; cgroup-gated (inert local) |
| P4 | Dedicated node pool + digest-pin + pre-pull | code done | infra-as-code (subagent); INERT until COMPUTE_NODE_POOL/DIGEST set + node joined; `make scale-up` = explicit-confirm gate |
| P5 | Hibernation | deferred | |

**Build/test state (2026-07-07):** gateway `tsc` clean; cli `tsc` clean + `tsup` build OK; full cli vitest **366 passed / 21 skipped**; new tests: cron nextRunAt (5) + evictOneIdle (4). Local `lmthing serve` smoke: boots, no self-idle/mem-watchdog started, cron via in-process tick — local dev unchanged. **Next: commit main → deploy → prod verify with real user.**

## Detailed checklist

### Phase 1 — Scale-to-zero
- [ ] gateway `tokens.ts`: signComputeToken / verifyComputeToken (aud:compute)
- [ ] gateway `db.ts`: withLeaderLock (pg_try_advisory_lock)
- [ ] gateway `compute.ts`: sweepIdlePods (replace stub), annotateLastActive, env inject, probe+grace
- [ ] gateway `routes/compute.ts`: POST /api/compute/self-idle
- [ ] gateway `cluster-status.ts`: leader-locked sweep tick
- [ ] compute `session-manager.ts`: evictOneIdle, residentCount/runningCount, lastActivityAt
- [ ] compute `serve.ts`: in-flight counter + isBusy, start self-idle watchdog (gated)
- [ ] compute `self-idle.ts` (new)
- [ ] unit: evictOneIdle

### Phase 2 — Externalized cron
- [ ] compute `cron.ts`: nextRunAt + daily fix, dueCronHooks update
- [ ] compute `cron-manifest.ts` (new): build + publish
- [ ] compute `serve.ts`: wire publish after bootCatchUp + before self-idle
- [ ] gateway migration `005_user_cron_jobs.sql` + ensureSchema mirror
- [ ] gateway `db.ts`: replaceCronManifest / selectDueCronJobs / markCronWoken
- [ ] gateway `routes/compute.ts`: POST /api/compute/cron-manifest (60min clamp, jitter, cap)
- [ ] gateway `tiers.ts`: cron policy { minIntervalMs, maxJobs }
- [ ] gateway `cluster-status.ts`: leader-locked cron-wake tick
- [ ] unit: nextRunAt (4 shapes + daily wall-clock)

### Phase 3 — Burstable + memory watchdog
- [ ] gateway `tiers.ts`: PodConfig cpuRequest/memRequest; free burstable
- [ ] gateway `compute.ts`: request/limit split (deployment + ensureUserPod patch); NODE_OPTIONS
- [ ] compute `mem-watchdog.ts` (new): cgroup soft/hard eviction
- [ ] compute `serve.ts`: wire watchdog; 503 on hard pressure
- [ ] compute `app/build/pages.ts`: build mutex + pressure gate

### Phase 4 — Node pool + digest-pin + pre-pull
- [ ] gateway `compute.ts`: nodeSelector + tolerations; digest-pin + IfNotPresent
- [ ] devops terraform: B8as_v2 pool node + data disk
- [ ] devops kubespray: label + taint pool node
- [ ] devops `compute-prepull.yaml` DaemonSet
- [ ] CI: COMPUTE_IMAGE_DIGEST alongside tag
- [ ] `make scale-up` (real Azure VM purchase — explicit-confirm gate)

### Verification
- [x] build + typecheck + pnpm test (both packages) — gateway tsc clean, cli 366 pass, web build clean
- [x] local smoke (lmthing serve + web, no gateway env) — inert, cron via in-process tick
- [x] commit + push main → deploy (CI/ArgoCD) — deployed c9e53f0, ArgoCD Synced/Healthy
- [x] per-phase prod acceptance gates (minted user prodtestpods1)
- [x] full-feature regression — THING agent responded; budget/report-bug/upgrade/studio UI ✓
- [x] multi-user validation (3 pods) — density, no OOM, scale-to-zero all ✓
- [~] full-scale stress (50→200→500) — **GATED on the dedicated pool node** (Azure spend); infra is code-ready (enable_user_pool toggle)
- [x] teardown — test namespaces + cron rows + local secret scripts removed; tree clean

## Definition of Done — status
1. ✅ Phases 1–4 implemented, built, typechecked, unit-tested, **deployed to prod** (c9e53f0).
2. ✅ Per-phase acceptance gates green on prod:
   - **P1** scale-to-zero: `/self-idle{idle:true}`→replicas 0; `/ensure`→wake 1 (fast, digest cached). Sweep backstop live. Self-idle + mem-watchdog started in pod.
   - **P2** cron: manifest publish → 60-min floor clamp (300000→3600000) + jitter; gateway cron-wake scaled pod 0→1 for a due job; pod republished (row cleaned). Zero model calls.
   - **P3** Burstable (50m/256Mi live) + NODE_OPTIONS=307 + mem-watchdog started (cgroup-gated). evictOneIdle unit-tested. *(actual eviction-under-load ⇒ node stress, deferred.)*
   - **P4** digest-pin image + IfNotPresent live; upgrade prompt + upgrade flow ✓; nodeSelector inert (COMPUTE_NODE_POOL unset) — safe on single node.
   - **claimTick** exactly-once ticks verified (one sweep/tick across 2 replicas, was 2×).
3. ✅ Full-feature regression green (minted user): THING agent responded "pods are alive"; budget 100%, report-bug button, upgrade flow, studio+chat UI, pod routing (/api/projects,/api/sessions 200).
4. [~] Stress: small multi-user (3 pods) density + no-OOM + scale-to-zero ✓; **full 50→200→500 requires the dedicated tainted node (money gate).**
5. ✅ Teardown complete; no `.issues/` opened.

**Bonus fix (pre-existing, exposed by scale-to-zero):** PodEnsureGate stuck on "Starting compute pod…" (unstable effect deps) → fixed; the gate now advances (verified).

**REMAINING (user decision — recurring Azure spend):** provision the `Standard_B8as_v2` pool node
(`enable_user_pool=true` + `make scale-up`), then set `COMPUTE_NODE_POOL=user` on the gateway and run
the full 50→200→500 density stress. Everything is code-ready and inert until then.

## Incident 2026-07-07 — pods 503 "connection refused" under load (FIXED, deployed 0124f64)
Returning users' pods 503'd. **Root cause:** the `readinessProbe` I added (P1) on the pod.
The compute pod is a single-threaded Node server — during a QuickJS agent turn / esbuild page
build the event loop blocks > the probe's 1s timeout → probe "context deadline exceeded" → K8s
**evicts the BUSY pod from the Service endpoints** → Envoy no endpoint → 503. Self-inflicted under
its own load. Confirmed in prod: probe failed 2min post-boot, mid agent-turn.
**Fix (gateway `compute.ts`):** `readinessProbe` → **`startupProbe`** (gates only the boot window,
never runs after first success, so a busy event loop can't evict a running pod). `ensureUserPod`
patch nulls the old readinessProbe on existing pods. Added a bounded (~9s, < ingress timeout)
readiness wait in `ensureUserPod` so `/ensure` returns once the pod is serving (closes the cold-wake
connect race). **Verified:** `GET lmthing.chat/api/sessions`→200 (was 503); busy pod stayed
`ready 1/1` + in endpoints across an 18s agent turn (no flapping). Reporting user hot-patched for
immediate relief. **LESSON: never put a readinessProbe on a single-threaded runtime that blocks the
event loop — it self-yanks under load; use a startupProbe.**

## Follow-on 2026-07-08 — Instant, universal pod wake (SHIPPED + live-verified, gateway `0cbd977`)

Two gaps after scale-to-zero: (1) only the SPA's explicit `/ensure` (and cron) woke a pod — a
DIRECT request (lmthing.app page nav, WS, external, or an SPA call before the gate) hit `replicas:0`
→ Envoy 503 with no wake; (2) the SPA gate flipped "ready" on the `/ensure` 200 without checking
`pod.ready`, so children could mount against a still-booting pod → 503s.

Shipped (plan `~/.claude/plans/with-all-that-context-validated-sky.md`):
- **Envoy activator** (computer/studio/chat/app `-policies.yaml`): `envoy_on_request` stashes the
  validated JWT + document-nav flag in dynamic metadata; `envoy_on_response` detects an Envoy
  no-endpoint 503/504 (discriminator: **absent `x-envoy-upstream-service-time`** ⇒ Envoy-generated,
  not a pod-origin 503), fires a fire-and-forget `httpCall("gateway-activator", …)` →
  `POST /api/compute/wake`, and returns a self-healing "waking…" response (auto-reloading HTML for
  document navs, `{waking:true}` JSON for XHR/WS). `activator-patch.yaml` (EnvoyPatchPolicy) injects
  the `gateway-activator` STRICT_DNS cluster → `gateway.lmthing.svc:3000`; needs
  `enableEnvoyPatchPolicy: true` (added to the ansible envoy_gateway role; patched live on the
  controller ConfigMap + restarted).
- **Gateway**: `wakeUserPod()` (fast scale 0→1, no readiness wait / no env re-inject); `POST
  /api/compute/wake` (authMiddleware — the activator forwards the JWT, so a caller can only wake its
  OWN pod; no shared secret, no public-edge exposure); startupProbe `periodSeconds 2→1`
  (`failureThreshold 60→120`), ensure readiness poll `600→300ms`.
- **SPA** (`gates.tsx`): after `/ensure`, poll `/api/compute/status` until real `pod.ready` before
  mounting children; copy → "Waking your workspace…". **`authFetch`** (`@lmthing/auth`): transparently
  retry on the activator's `{waking:true}` 503 (a no-endpoint 503 = request never reached the pod =
  zero side effects, so retrying even a POST is safe).
- **Compute boot** (`bin.ts`): defer `syncSystemSpaces` (system-spaces hashDir walk) until AFTER the
  HTTP server is listening; keep only materialize-if-needed pre-`listen` — removes a per-boot hash
  walk from the cold-wake time-to-serve path.

**Live-verified (prod, test user 379847043318834826):**
- Direct XHR to a scaled-to-zero pod → `503` `retry-after:2` `{"waking":true}`; direct document nav →
  `503` self-healing "Waking your workspace…" HTML; **the pod scaled 0→1** (activator httpCall). ✓
- Warm-image cold wake **~6s** (503 `{waking:true}` throughout the window → 200); a still-terminating
  pod and a warm pod both returned **200** (activator never hijacks a real pod response). ✓ (The very
  first wake after the digest bump took ~118s = one-time cold pull of the OLD digest; now cached.)
- SPA (browser): cold lmthing.chat showed "Waking your workspace…", then landed on the full THING
  chat UI with **zero 503s** across all pod calls (`/api/projects`, `…/sessions`, `…/spaces` all 200). ✓
- `EnvoyPatchPolicy` Accepted+Programmed; `gateway-activator` cluster present in Envoy config;
  `lmthing-core` + `lmthing-envoy` Synced/Healthy; gateway/chat/studio/computer on `0cbd977`,
  compute digest `6d5591…`.

Note: true sub-second wake was explicitly NOT targeted (needs a warm-pool / stateless-pod redesign,
deferred P5). "Fast + never-broken" (~6s, always self-healing, never a dead 503) was the agreed goal.

## Log
- 2026-07-08 — Instant/universal pod wake implemented, built, typechecked (gateway+cli+web),
  cli tests green (92), committed (top `0cbd977`→CI `fc5aab1a`, sdk/org `131dec1`), deployed via
  CI/ArgoCD + a live controller patch for `enableEnvoyPatchPolicy`, and live-verified end-to-end.
- 2026-07-06 — Plan approved. PROGRESS.md reset for this effort. Reading anchor files (gateway spine first).
- 2026-07-07 — P1–P4 implemented, built, typechecked, unit-tested; local smoke green (inert w/o gateway env). Committed to main; CI built gateway+compute; digest-pin wired end-to-end (COMPUTE_IMAGE_DIGEST=sha256:fd03f80 in gateway.yaml + prepull, in lockstep). ArgoCD Synced/Healthy; gateway+studio rolled to 0939ead.
- 2026-07-07 — **Prod verify (minted user prodtestpods1):** ✅ Burstable podConfig live (50m/256Mi); pod runs digest image + IfNotPresent (P4), Burstable resources + NODE_OPTIONS=307 (P3), 45s grace + /api/sessions readiness + last-active annotation (P1); pod boot log shows `[self-idle] watchdog started` + `[mem-watchdog] started`. ✅ **Scale-to-zero cycle**: /self-idle{idle:true} → replicas=0; /ensure → wake replicas=1 (fast, digest cached). ✅ Gateway: both replicas "refresher + controllers started"; `[sweep]` tick live.
- 2026-07-07 — **2 fixes (batched redeploy):** (1) leader-lock only blocked *simultaneous* runs; offset replica ticks both fired (~2×, safe but not exactly-once) → new `claimTick` (atomic spacing-based cross-replica dedup) replaces withLeaderLock in the ticks. (2) PRE-EXISTING `gates.tsx` PodEnsureGate race (unstable effect deps → stuck "Starting compute pod…"), made frequent by scale-to-zero cold-starts → depend on stable `session?.accessToken`. Both typecheck+build clean; committed; redeploying.
