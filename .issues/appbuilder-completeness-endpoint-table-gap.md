# appbuilder: completeness gate misses endpoint→table existence; builds remodel unrelated data

**Symptom** (06-tanzania run 25 step 10, 2026-07-19): user asked to record actual payments. The
build shipped `actual-payments-list` and `blended-spending-total` endpoints that 500 at runtime —
**no backing table was ever created** (confirmed via `.tables` + curl probes; step-10.json shows 12
errors). The same build gratuitously remodeled unrelated data: 4 new tables
(tariff_categories/tariff_rates/visitor_guidelines/media) nobody asked for.

**Attribution:** the build-completeness gate (system-appbuilder, `build_live_project`) verifies
pages/imports/compile but has no check that every endpoint's referenced table exists in the schema;
and no scope rule bounds the build to the entities the request names.

**Proposed fix (L1/L2, system-appbuilder):**
1. Completeness gate: for every generated/updated endpoint, statically confirm the tables it
   queries exist in the schema manifest — a missing table fails the gate the same as an unresolved
   import (mechanical check, not prose).
2. Scope rule in the build nodes: touch only entities the request names or that the named entities
   structurally require; never remodel unrelated tables in the same pass.

**Verify:** re-run 06 step 10 class (a "start recording X" request against an existing app): new
table exists, endpoints 200, no unrelated schema churn.

---

## Sibling gap — page `useApi('name')` → endpoint existence (06-tanzania run 32 step 3, 2026-07-20)

Same invariant class, but on the FIRST build and on the client side. `pages/index.tsx`,
`pages/costs.tsx`, `pages/visas.tsx` all call `useApi('costs-summary')`, but `costs-summary` was
never generated — the real `api/` dir has only costs-breakdown, costs-list, costs-create,
dashboard-summary, trip-summary. `useApi` validates the name client-side and short-circuits to an
error state WITHOUT issuing an HTTP request (no `costs-summary` network entry on a hard reload,
verified via chrome-devtools). Runtime result: homepage "TOTAL COST" tile shows €0 + $0 (real:
€2707 flights + $3344.20 costs in app.db), "NEXT UP" leaks a literal "EUR null", and the dedicated
/costs page shows only "Could not load cost data." — total failure, not partial.

The build's own signals miss it entirely: `appBuild.built:true`, `appPageStatus:200` (the harness
probe only checks the root page's raw HTTP status; the page renders an error state at 200).

**Attribution:** `build_live_project` plan_pages/implement_pages assigns a page's data-fetch
endpoint name as a FREE STRING without cross-checking it against the generated endpoint list
(plan_endpoints/implement_endpoints); the typecheck gate sees a string literal, not a checked union,
and the completeness gate has no page→endpoint reference check. Same class as the R1-committed
"hardcoded literal instead of live endpoint" fix.

**Proposed fix (mechanical, cheaply UNIT-TESTABLE — no full build needed):** extend the completeness
gate so every client `useApi('<name>')` reference in a generated page must resolve to a real
generated endpoint name — a missing name fails the gate exactly like an unresolved import. Best
verified as a gate unit test (feed a page with a bad `useApi` ref + the endpoint list → gate fails),
NOT a slow full-build repro. Pairs naturally with the endpoint→table check above (both are
reference→existence static checks).

**Evidence:** scenarios/06-tanzania/runs/32/step-03.json; data/.lmthing/tanzania-trip-2026/pages/{index,costs,visas}.tsx (grep `costs-summary`); the api/ dir listing (no costs-summary). Pre-bug snapshot: scenarios/06-tanzania/runs/32/snapshots/step-02/.
