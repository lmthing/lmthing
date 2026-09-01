## Tasklist format

`tasklists/<slug>/index.md` holds `input:` (a `field: type` map) and the goal line. Each node is `NN-<id>.md` with frontmatter `id`, `dependsOn` (other node ids), optional `condition`, `forEach`, `role`, and `output:` — a `field: type` map of what completing the node hands downstream.

The graph must be acyclic and every `dependsOn` must name an existing node — both are checked at write time and at load.