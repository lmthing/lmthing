---
id: plan
dependsOn:
  - inspect
condition: inspect.findings != null
output:
  fixes: array
  polish: array
---

Turn the findings into two ordered work queues. Run `planIteration` over `findings` verbatim — it is the split, do not re-derive it: `fixes` for findings whose severity is `fix` (they break the app or the done-gate), `polish` for the rest. Within each lane keep the caller's order as priority; across lanes, fixes come first by construction. Then assign each item an OWNER before any work starts: an always-null binding is an endpoint defect, a nav target that is not a route is the page that names it, an empty render may be a table with no rows. Touch only what the findings name — an artifact no finding mentions is left exactly as it is.