---
id: polish
dependsOn:
  - plan
forEach: plan.polish
output:
  polished: array
---

Work the POLISH lane, one item per pass (`item` is one `"area: detail"` string from `plan.polish`). These do not block the gate — do them only while they cost less than they return, and record in `polished` the ones actually done. NEVER let a polish touch a fixed artifact's behavior: if a polish would change what an endpoint returns or what a section binds, it is not polish — record it as a new finding instead and leave the fix lane's result intact. Run the touched page's save-time validation after each change so polish cannot introduce a contract break.