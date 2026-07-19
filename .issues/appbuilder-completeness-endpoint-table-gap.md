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
