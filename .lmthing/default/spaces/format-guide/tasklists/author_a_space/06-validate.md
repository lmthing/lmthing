---
id: validate
dependsOn:
  - tasklist
output:
  report: string
role: general
---

Run validate_space and fix every reported problem. Then prove the space usable: set_agent to the new agent and walk its tasklist with start_task/complete_task from scaffold to a completed run. Record the outcome as `report`.