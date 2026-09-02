---
id: verify
dependsOn:
  - wire
output:
  report: string
---

Prove the app, per `project/gates/done`. Run the whole-app check first (`validateAppViews`): no orphan page no navigation reaches, no nav target that is not a route, no page without a data-bound section, no malformed spec. Then against live data (`renderSmokeViews` with an api caller): no empty render, no always-null binding, and NO page left unmeasured — coverage `null` is not a pass. Fix what these find in the artifact that owns the finding (an always-null binding is an endpoint defect, not a view defect) and re-run until the finding list is empty. Smoke the endpoints too: a non-2xx response is never data. Report what was checked and what remains as `report` — honestly, carrying anything still broken forward as named findings rather than folding it into a clean result.