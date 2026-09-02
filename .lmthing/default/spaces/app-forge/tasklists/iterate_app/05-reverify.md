---
id: reverify
dependsOn:
  - fix
  - polish
output:
  report: string
---

Re-prove the WHOLE app fresh from disk, per `project/gates/done` — not just the artifacts this pass touched, because a fix to one part can break another (a renamed column, a duplicated route). The whole-app check and the live smoke run again: no orphan page, no dead nav target, no empty render, no always-null binding, nothing left unmeasured. Anything still broken is recorded in `report` as named findings for the NEXT iteration, never folded into a clean result — an iteration ends honestly or it does not end.