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
- Ran Act I live (12.6 min, 16/26). Offer half PASSED: turn 1 read all 6 files (system-files/vision), OFFERED citing 9 real specifics, no premature build yield/delegate. **Build half FAILED.**

## Session 2 (2026-07-14, resume) — triage + fix the Act I build failure

- **Root cause (from `results/trace.json`, only 232 events, 2 THING turns):** after "Yes please" THING went STRAIGHT to path 4a (delegate → system-appbuilder/automator) — but its delegate `args` were `[...,null,{query}]` with **NO `attachmentIds`**. The query said "seed from inventory.csv / the xlsx / the invoice"; the automator had none of those bytes, so it correctly returned `ok:false, "Cannot proceed without attached files"`. THING never recovered → 0 spaces, 0 tables, app `built:false`, `/` 404. (Secondary: an automator recovered typecheck error `Cannot find name 'existingTables'` — the classic vars-don't-persist flail while it had nothing to build.)
- **Verified the mechanism:** `delegate(pkg, agent, {query, attachmentIds})` IS supported — `DelegateOpts.attachmentIds` (`libs/core/src/globals/delegate.ts:10`), resolved by `session.ts:945` runDelegate → bytes attached to the delegate's message. So the fix is real: THING just never populated it.
- **Why THING dropped them:** its instruct PROSE says "hand the attachment id to the automator … Pass the ids. Every time." but the **CODE EXAMPLE for the automator delegate omitted `attachmentIds`**, and the model copied the example over the prose.
- **Fix (generalizable, 0 scenario-specific strings) — submodule `73f50d5`:**
  - `user-thing/agents/thing/instruct.md`: added `attachmentIds` to the automator-delegate example + a pointed "NOT optional when files were attached; a query naming attachments with no ids is the single most common build failure (`ok:false`)".
  - `system-appbuilder/agents/automator/instruct.md`: "If you cannot SEE the source, STOP — an empty table is honest, a fabricated full one is a lie the user acts on and the hardest to ever catch." (+ degeneralized stale 07-life-admin insurance/boiler examples to neutral ones). NOTE: these two instruct files' pre-existing uncommitted edits were from THIS task's own attempt-1 (confirmed in attempt-1/output.jsonl) — folded in and committed.
- **Deployed:** pushed submodule `e727ee7..73f50d5`, bumped parent pointer + pushed `a6864239..aa05c7fb` → CI builds `compute:aa05c7f`.
- **STILL OPEN (next):** (1) verify the fix live — upgrade test pod to `compute:aa05c7f`, re-run Act I, confirm the app now builds + tokens land in rows. (2) The **spaces gap**: THING created 0 per-topic spaces (went straight to path 4a). Scenario needs ≥4 incl. a `stock` space (Act IX `<Chat agent="stock/advisor">` + Act II research knowledge). Open question / design tension: should THING create knowledge spaces UNPROMPTED on a pure data-dump, or is the ≥4 assertion over-specified? Decide after seeing whether the app-build fix alone gets Acts I–XIV meaningfully further. (3) Acts II–XIV never ran yet.
