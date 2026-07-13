# PROGRESS — scenario-campaign · task `07-life-admin` · round 1

_Started 2026-07-12T21:45:59.237Z. The agent MUST update this file at every step._

## Steps

- Oriented: read scenario.md (fully authored, 7 Acts + Edges — NOT a stub; run.mjs absent → must scaffold from template). Read harness libs, 06-tanzania runner (closest reference), integration-demo space.
- Confirmed pod routes: `GET /api/hooks`, `POST .../hooks/:slug/run`, `GET/POST .../app/build`, `GET .../app/data/:table`, `GET .../app` (manifest). integration-demo webhook = `x-demo-signature: sha256=<hex>` keyed by `INTEGRATION_DEMO_WEBHOOK_SECRET`.
- Kicked off provision (07-life-admin) + smoke in background while scaffolding run.mjs.

### Attempt 2 (session resumed 2026-07-13)

- Re-oriented: `run.mjs` (444 lines, 8 Acts) + `scenario.md` (7 Acts + Edges) are committed and match 1:1. `results/checkpoint.json` holds a provisioned user (`07-life-admin-mribsq4o`, user-381508759907755658) + project `life-admin`, but **no Act has passed yet** → baseline never ran.
- Hardening fix: runner now calls `thing.syncToTail()` after resume (a resumed session replays its whole trace into the next turn's slice — scenario 10 got a false pass from exactly this).
- `node smoke.mjs` → PASS (prod healthy: pod reachable, 13-space store catalog, real THING turn 11.7s, budget 100%).
- Launched Act I live (`--acts=1`) in background + a Monitor on its log (Bash foreground caps at 10 min; Act I ingest→build runs longer).
- Read `@app/runtime`'s `Chat` component (`libs/cli/src/app/runtime/chat.tsx`): `<Chat agent="space/agent" projectId>` opens a REAL session via `POST /api/sessions {spaceRef, projectId}` → the in-app chat mandated by the campaign's app contract (A1) is buildable today; new Acts IX (in-app chat authors a real change) + X (chrome-devtools render verification) will assert it.

## Files added to context

- sdk/org/scenarios/07-life-admin/scenario.md — the spec (7 Acts) I implement 1:1
- sdk/org/scenarios/_template/{scenario.md,run.mjs} — hardening scaffold to copy
- sdk/org/scenarios/06-tanzania/run.mjs — closest working reference (ingest→spaces→app→update)
- sdk/org/scenarios/harness/lib/{thing,pod,report,gateway,paths}.mjs — harness API
- sdk/org/scenarios/harness/{provision,smoke}.mjs — provisioning + smoke
- sdk/org/scenarios/07-life-admin/fixtures/policies.md — seed dump + unmistakable FILE_FACTS tokens
- store/spaces/integration-demo/{events/messages.ts,package.json} — Act VI inbound signature + secretEnv
- sdk/org/libs/cli/src/server/serve.ts — route table (hooks/app/data routes)
- sdk/org/scenarios/07-life-admin/run.mjs — the runner (8 Acts) I must baseline then extend
- sdk/org/scenarios/10-family-recipes/run.mjs — the most recent live-run reference (Acts VIII–X: memory, consent-denied, engineer)
- sdk/org/libs/cli/src/app/runtime/chat.tsx + index.ts — proves `<Chat>` is exported from `@app/runtime` (the A1 in-app chat surface)
