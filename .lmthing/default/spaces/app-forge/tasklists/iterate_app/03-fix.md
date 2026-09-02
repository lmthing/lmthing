---
id: fix
dependsOn:
  - plan
forEach: plan.fixes
output:
  fixed: array
---

Work the MUST-FIX lane, one item per pass (`item` is one `"area: detail"` string from `plan.fixes`, in priority order). Load the knowledge aspect for the item's area before touching it, fix the artifact that OWNS the finding (endpoint for an always-null binding, the naming page for a dead nav target, the table for a missing column), and re-run the check that surfaced the finding to confirm it is gone. A fix that turns out to be wrong-headed is not silently dropped — record it in `fixed` with what actually happened. An empty `plan.fixes` means this node has nothing to do; record an empty `fixed` and move on.