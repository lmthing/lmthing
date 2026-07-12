# PROGRESS — scenario-campaign · task `07-life-admin` · round 1

_Started 2026-07-12T21:45:59.237Z. The agent MUST update this file at every step._

## Steps

- Oriented: read scenario.md (fully authored, 7 Acts + Edges — NOT a stub; run.mjs absent → must scaffold from template). Read harness libs, 06-tanzania runner (closest reference), integration-demo space.
- Confirmed pod routes: `GET /api/hooks`, `POST .../hooks/:slug/run`, `GET/POST .../app/build`, `GET .../app/data/:table`, `GET .../app` (manifest). integration-demo webhook = `x-demo-signature: sha256=<hex>` keyed by `INTEGRATION_DEMO_WEBHOOK_SECRET`.
- Kicked off provision (07-life-admin) + smoke in background while scaffolding run.mjs.

## Files added to context

- sdk/org/scenarios/07-life-admin/scenario.md — the spec (7 Acts) I implement 1:1
- sdk/org/scenarios/_template/{scenario.md,run.mjs} — hardening scaffold to copy
- sdk/org/scenarios/06-tanzania/run.mjs — closest working reference (ingest→spaces→app→update)
- sdk/org/scenarios/harness/lib/{thing,pod,report,gateway,paths}.mjs — harness API
- sdk/org/scenarios/harness/{provision,smoke}.mjs — provisioning + smoke
- sdk/org/scenarios/07-life-admin/fixtures/policies.md — seed dump + unmistakable FILE_FACTS tokens
- store/spaces/integration-demo/{events/messages.ts,package.json} — Act VI inbound signature + secretEnv
- sdk/org/libs/cli/src/server/serve.ts — route table (hooks/app/data routes)
