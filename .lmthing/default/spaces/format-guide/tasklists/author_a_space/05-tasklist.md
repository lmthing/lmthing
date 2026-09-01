---
id: tasklist
dependsOn:
  - agent
output:
  slugs: array
---

Author the tasklist with write_tasklist_node: one node per stage, `dependsOn` wiring the true order, `output:` declaring what each completion hands downstream. Run checkDag over the planned nodes BEFORE writing; unknown deps and cycles are refused. Record the slugs as `slugs`.