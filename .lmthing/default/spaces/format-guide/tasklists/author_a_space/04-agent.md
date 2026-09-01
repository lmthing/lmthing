---
id: agent
dependsOn:
  - functions
  - knowledge
output:
  ref: string
---

Write the agent with write_agent: frontmatter `functions` must name functions authored in this space, `knowledge` must list the domains just authored, `canDelegateTo` per its four states, and one `actions` entry per tasklist (id/label/description/tasklist). Record `<project>/<space>/<slug>` as `ref`.