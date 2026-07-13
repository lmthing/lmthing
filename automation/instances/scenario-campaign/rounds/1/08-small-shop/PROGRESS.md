# PROGRESS — scenario-campaign · task `08-small-shop` · round 1

_Started 2026-07-12T23:56:09.625Z. The agent MUST update this file at every step._

## Steps

- **Orient.** Read `08-small-shop/scenario.md` (fully authored: 6 sections + Acts I–VIII + Edges, but
  NO `run.mjs`). Read `_template/run.mjs`, harness libs (`pod.mjs`, `thing.mjs`, `report.mjs`,
  `provision.mjs`, `paths.mjs`), `README.md`, and the two closest sibling runners `06-tanzania/run.mjs`
  + `07-life-admin/run.mjs`. 07-life-admin is a near-1:1 structural sibling (ingest→build, research,
  form, cron, self-evolution, inbound, update+restraint+multilingual, edges) → adapting it.
- **Baseline plan.** scenario.md already specifies 8 Acts (I–VIII) + Edges → implement all as the
  baseline runner. Fixtures present: `inventory.csv` (materials/products/suppliers/sales) +
  `product-photo.png` (placeholder). No voice memo → audio path noted-skipped (same as 07).
- **NEW Acts (goal 2).** Chosen 3 from the catalog covering capabilities 08 does NOT yet cover
  (per §5 checklist gaps): **IX — Remember me (`user-memory` routing + recall)**, **X — Event storm
  (pod resilience / worker containment)**, **XI — Restart → auto-resume (pod lifecycle)**.

## Files added to context

- `sdk/org/scenarios/08-small-shop/scenario.md` — the spec I'm implementing (all 6 sections + Acts).
- `sdk/org/scenarios/_template/run.mjs` — runner scaffold + hardening patterns.
- `sdk/org/scenarios/harness/lib/{pod,thing,report,paths}.mjs` — harness API surface I assert through.
- `sdk/org/scenarios/harness/provision.mjs` + `README.md` — provisioning + run conventions.
- `sdk/org/scenarios/06-tanzania/run.mjs`, `07-life-admin/run.mjs` — sibling runners (07 ≈ 1:1 template).
- `sdk/org/scenarios/08-small-shop/fixtures/inventory.csv` — the seed data / FILE_FACTS source.

## Live run — round 1

- **Committed scaffold** (submodule `sdk/org` 8924b02): run.mjs + scenario.md updates.
- **Smoke** green: fresh prod user, 13 store spaces, THING turn 16.8s, 0 eval errors.
- **Act I PASS 15/15** (~6 min): user `381522...`? see checkpoint. system-files + system-vision
  delegated; ≥3 CSV facts; 4 spaces (shop-catalog-products/sales/stock-materials/suppliers); app
  built:true (tables materials/products/sales/suppliers, 17 rows, pages / /products /sales), /app/
  200. 4 recovered authoring errors (deliverables landed).

- **Act II** first FAIL (research ran, 19 web yields, but NO db row persisted; follow-up admitted
  "no saved alternative"). Triage: **phrasing** — soft "save into suppliers section" → no row. Made
  the ask explicit ("add as a NEW row in the app") + tightened assertions → PASS (found real Dutch
  supplier **Beeldhouwwinkel**, absent from seed; db grew 3203→4143). Commit 0d03742.
- **Act III**: browser POST to `/app/<id>/api/*` returns **405 from nginx** — on `lmthing.chat`,
  `/app/*` is the web SPA host, not the pod; the app's own API lives on the app host. Rewrote Act III
  to drive the **reachable** db.insert→emitter→hook chain via chat (as scenario 05 does): assert the
  db-INSERT hook wiring (`process-sale-log-stock` on `project/db.sale_logs.insert`) + sale row + stock
  decrement. Commit 842e091.
- **PRODUCT BUG (severe) found live:** after a session eviction/auto-resume, a message POSTed to a
  **still-initializing** session made `SessionManager.sendMessage` throw; the HTTP `/message` handler
  dropped the fire-and-forget promise → **unhandledRejection → whole pod process crash**; the retried
  message **CrashLoopBackOff**ed the pod (10 restarts, dead ~30 min). Fix: route the rejection to the
  session error stream like the WS path already does (`routes/sessions.ts`). Regression test asserts
  no unhandledRejection escapes. **Fix sha sdk/org 7b654a9; parent 29ddb387** → CI building
  `compute:29ddb38`. Raised MAX_SESSIONS=25 on the test pod to cut eviction churn.

- **Deployed fix live:** CI built `compute:29ddb38` (build (compute) success). Upgraded test pod
  `kubectl set image ... compute:29ddb38` → rolled out. **Crashloop GONE** — sessions now go to
  `status:error` gracefully instead of crashing the pod process (fix verified live).
- **Finding B (documented, data-repaired):** after the deploy, every *ceramics-shop* session still
  entered error state (but `user` project sessions were fine → project-specific). Root cause via
  probes: `[app-boot] Non-additive schema divergence in table "sale_logs"` — the automator, hammered
  by Finding A's retry-storm during Act III, re-authored sale_logs and left orphaned live columns
  (`name`, `processed_at`, `created_at`) absent from the schema file; app-boot's fail-loud guard
  (correct — protects data) throws in `getProjectAppGlobals` during session init → **the whole
  project's THING is bricked** (can't even chat to repair it). Two sub-issues: B1 automator should do
  additive-only schema changes; B2 a broken project app should not brick session init. Repaired the
  schema (restored the 3 orphaned columns via PUT app/files) → app boots, fresh ceramics-shop session
  OK ("17 products", 0 errors). The retry-storm that caused B was itself Finding A, now fixed → far
  less likely to recur. B recorded as an authoring-reliability + resilience follow-up.

## Live-run verdicts (all Acts exercised e2e against prod)

- **Act I** PASS 15/15 · **Act II** PASS (research→Beeldhouwwinkel row persisted) · **Act III** PASS 11/11
  (db.insert→hook, sale row + stock decrement) · **Act IV** PASS (headline: reorder DRAFT to Sibelco,
  nothing sent) · **Act V** PASS (cron→insights row) · **Act VI** PASS (workshops+wholesale add spaces
  +tables+pages, app recompiles) · **Act VII** PASS (install consent, signed inbound→row, bad sig→401)
  · **Act VIII** CONDITIONAL (restraint ✅✅ + Dutch multilingual routing ✅; the db.update *landing*
  flakes ~50% on the automator's authoring reliability — "Cannot find name X" — known §7 follow-up) ·
  **Act IX** PASS 2/2 (user-memory routed + recalled) · **Act X** PASS 3/3 (15/15 storm, loop not
  starved) · **Act XI** PASS 5/5 (restart→auto-resume; live-verifies the crashloop fix) · **Edges**
  PASS 6/6.
- **Fix A deployed + live-verified:** crashloop fix in `compute:29ddb38`, pod upgraded, Act XI + all
  post-deploy acts confirm the pod no longer crashes on message-to-initializing-session.
- **Verdict: CONDITIONAL PASS** — 10/11 Acts + Edges fully green; Act VIII conditional on the known
  automator db.update reliability follow-up.

## Round 1 — DONE (clean, committed, deployed, resumable)

- **Committed + pushed both repos** (submodule-first): sdk/org `3a4a120` (runner + scenario.md +
  Actual results + crashloop fix + test), parent `72a758a0` (pointer bump). Fix already shipped in
  parent `29ddb387` → `compute:29ddb38`.
- **Deploy verified live:** CI `build (compute)` for 29ddb38 = success; test pod on `compute:29ddb38`,
  Running 1/1 healthy (no crashloop); Act XI (restart→auto-resume) + all post-deploy Acts pass.
- **Definition of done:** scenario.md has 6 sections + checklist + Acts I–XI + Edges (incl. 3 new
  Acts IX/X/XI); run.mjs reproduces the flow 1:1 with hardening kept; every assertion reads trace/real
  state; ran e2e live → CONDITIONAL PASS; the one product bug (crashloop) fixed with a test + verified
  live; results/report.md + trace.json present; Actual results filled with verdict, per-Act table,
  issues+fix sha, perf table, and the honest breakdown narrative.
