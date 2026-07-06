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
- [ ] build + typecheck + pnpm test (both packages)
- [ ] local smoke (lmthing serve + web, no gateway env)
- [ ] commit + push main → deploy (CI/ArgoCD)
- [ ] per-phase prod acceptance gates (real logged-in user)
- [ ] full-feature regression
- [ ] multi-user stress test (50→200→500)
- [ ] teardown + Definition of Done

## Log
- 2026-07-06 — Plan approved. PROGRESS.md reset for this effort. Reading anchor files (gateway spine first).
- 2026-07-07 — P1–P4 implemented, built, typechecked, unit-tested; local smoke green (inert w/o gateway env). Committed to main; CI built gateway+compute; digest-pin wired end-to-end (COMPUTE_IMAGE_DIGEST=sha256:fd03f80 in gateway.yaml + prepull, in lockstep). ArgoCD Synced/Healthy; gateway+studio rolled to 0939ead.
- 2026-07-07 — **Prod verify (minted user prodtestpods1):** ✅ Burstable podConfig live (50m/256Mi); pod runs digest image + IfNotPresent (P4), Burstable resources + NODE_OPTIONS=307 (P3), 45s grace + /api/sessions readiness + last-active annotation (P1); pod boot log shows `[self-idle] watchdog started` + `[mem-watchdog] started`. ✅ **Scale-to-zero cycle**: /self-idle{idle:true} → replicas=0; /ensure → wake replicas=1 (fast, digest cached). ✅ Gateway: both replicas "refresher + controllers started"; `[sweep]` tick live.
- 2026-07-07 — **2 fixes (batched redeploy):** (1) leader-lock only blocked *simultaneous* runs; offset replica ticks both fired (~2×, safe but not exactly-once) → new `claimTick` (atomic spacing-based cross-replica dedup) replaces withLeaderLock in the ticks. (2) PRE-EXISTING `gates.tsx` PodEnsureGate race (unstable effect deps → stuck "Starting compute pod…"), made frequent by scale-to-zero cold-starts → depend on stable `session?.accessToken`. Both typecheck+build clean; committed; redeploying.
