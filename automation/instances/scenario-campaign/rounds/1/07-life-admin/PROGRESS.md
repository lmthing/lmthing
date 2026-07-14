# PROGRESS — scenario-campaign · task `07-life-admin` · round 1

_Started 2026-07-14T16:39:34.981Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->
- Oriented: read the authored Scenario 07 specification, scenario guide, and campaign progress log; confirmed the runner and result artifacts are absent and began locating the active harness layout.
- Triaged the artifact mismatch: `99bab95` deleted the tracked harness/template/runner despite this campaign requiring them. Identified `99bab95^` as the last tracked implementation revision and restored only the missing executable artifacts from it for inspection and local baseline execution.
- Reconciled the restored runner with the 14 baseline Acts and made its provisioning local-safe (skip the production-only `mergePodEnv` route when `SCENARIO_TARGET=local`). Started the shared local pod and passed the real-model harness smoke test (projects/catalog/session/LLM/display).

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- `sdk/org/scenarios/07-life-admin/scenario.md` — authored 14-Act acceptance specification to implement exactly.
- `sdk/org/scenarios/README.md` — scenario artifact and harness orientation.
- `automation/instances/scenario-campaign/rounds/1/07-life-admin/PROGRESS.md` — mandatory per-run ledger to update.
- `sdk/org/scenarios/_template/run.mjs` — expected runner scaffold (absent from the current checkout).
- `sdk/org/scenarios/harness/{provision.mjs,local-server.mjs,lib/pod.mjs,lib/thing.mjs,lib/report.mjs}` — expected harness API files (absent from the current checkout).
- `sdk/org/scenarios/07-life-admin/run.mjs` (restored from `99bab95^`) — prior tracked 14-Act implementation, reconciled with the current spec before local execution.
- `sdk/org/scenarios/07-life-admin/reset-project.mjs` (restored from `99bab95^`) — clean project/checkpoint helper for rerunning an authoring baseline.
- `sdk/org/scenarios/harness/lib/{local.mjs,gateway.mjs,paths.mjs}` — local-target lifecycle, provisioning, and paths.
- `sdk/org/scenarios/harness/smoke.mjs` — local pod and live-model smoke contract.
- `sdk/org/scenarios/07-life-admin/fixtures/links.md` — fixture tokens and provenance.
- `sdk/org/scenarios/_template/{scenario.md,run.mjs}` — canonical artifact structure and hardened runner patterns.
