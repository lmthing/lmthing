# PROGRESS — scenario-campaign · task `08-small-shop` · round 1

_Started 2026-07-13T22:10:15.342Z. The agent MUST update this file at every step._

## Steps

- Oriented: read `scenario.md` (fully authored, 8 sections, 14 Acts I–XIV + Edges), all 6 fixtures + links.md + voice-memo.txt present & verified. `run.mjs` does NOT exist yet → round 1 = implement it 1:1 from `_template/run.mjs`. `attempt-1/` is a prior cut-off invocation of THIS task (only did orientation, built nothing).
- Reference runners present: 05-latam (1146 L), 06-tanzania (904 L), 07-life-admin (1295 L). Harness libs: thing.mjs (443), pod.mjs (294), gateway.mjs (200), report.mjs (134), provision.mjs (66).

## Files added to context

- `sdk/org/scenarios/08-small-shop/scenario.md` — the spec (14 Acts, 6 fixtures, app contract, SSRF/consent/callConnection focus)
- `sdk/org/scenarios/08-small-shop/fixtures/{links.md,inventory.csv,voice-memo.txt}` — fixture content + expected tokens
- `sdk/org/scenarios/_template/run.mjs` — the runner skeleton to copy
- Read harness libs fully: `harness/lib/{thing,pod,gateway,report}.mjs` + `provision.mjs` — the API surface.
- Read `05-latam/run.mjs` (closest reference: integration-demo, signedInbound, fireAndTrace, callConnection env, installSpace consent-order, tasklist DAG) — reused its helpers.
- Verified fixture tokens against the ACTUAL bytes: full xlsx parse confirms WHL-0007 (OVERDUE, BV-2026-131), THERMO-K26 (thermocouple, on_hand 0, PCU/Potterycrafts UK), OX-COB-250 (Cobalt oxide, on_hand 1, reorder_at 1, KMA/Keramikos Amsterdam), GOLD-LUS-2 (kintsugi gold lustre). PDF has INV-3337 + 93.50. Fixtures MATCH scenario.md — no reconciliation needed.
- Checked: no direct REST route to invoke `callConnection`/`integrationStatus` — both are agent yields, must be driven through a THING turn. SSRF guard (`connections.ts` assertSafeBaseUrl/isBlockedHost/assertResolvedHostSafe → `blocked — …`) runs pod-side regardless of caller, so flipping env live + re-instructing THING exercises it. `integration-demo` package.json connection block: provider `demo`, apiBase env INTEGRATION_DEMO_BASE_URL, tokenEnv INTEGRATION_DEMO_API_TOKEN, hmac webhook secret INTEGRATION_DEMO_WEBHOOK_SECRET. `PUT /api/env` (env.ts) writes .env live (no pod roll); `PUT /api/compute/env` (gateway) rolls the pod.

## Run log

- Wrote `sdk/org/scenarios/08-small-shop/run.mjs` (14 Acts, ~560 lines), `node --check` OK. Committed submodule (180eebd).
- Provisioned disposable prod user `user-381656988204951178` (label smallshop). Smoke test PASS (prod healthy, 13 integration spaces incl integration-demo + integration-whatsapp, THING turn 8.2s green).
- Running Act I (dump→offer→build) live.
