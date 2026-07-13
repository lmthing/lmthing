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
