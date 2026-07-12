# Autonomous task — expand & ship the `{{task}}` project-application (round {{round}}: {{roundMode}})

`{{task}}` already exists from earlier rounds. This is a **FEATURE-EXPANSION round** — make it
**dramatically bigger**. Add a **very large batch** of brand-new capability to BOTH the spec and
the implementation, then build, test, and ship it exactly like round 1. Use
`automation/instances/app-builder/PROGRESS.{{task}}.md` to see what prior rounds built so you extend
rather than duplicate. **Never regress or delete what earlier rounds shipped** — expansion is
strictly additive, and everything (old + new) must stay green and live-tested before you push.

On this expansion round you must add, at minimum:
- **≥1 new project-scoped space** (a whole new specialist team under
  `store/projects/{{task}}/spaces/<newspace>/`) in **full format** (agents with charter+instruct,
  tasklists, functions, components, extensive knowledge) — and the app must end the round with
  **≥2 project-scoped spaces total**.
- **≥3 new agents** across the spaces — each least-privilege (config-bearing `capabilities:`
  frontmatter, per-verb `tables` scope).
- **≥5 new pages** + components (new routes, richer UX) — **design tokens only**.
- **≥8 new API endpoints** (named, typed, described) and **≥3 new hooks** (cron/database).
- **≥3 new database tables** (plus new columns/relations) to back all of the above.
- substantial **new user-facing features** in the spirit of the spec's "Additional features"
  sections — many more of them, **fully implemented**, not just described.
- **SPACE-FORMAT REMEDIATION (mandatory every expansion round until complete).** Bring every
  existing space up to the **full space format**: backfill missing `tasklists/`, `functions/`,
  `components/`, and especially **extensive `knowledge/`** for each agent/space, and give each agent
  a `charter.md` alongside its `instruct.md`. A space that is still just `agents/` is a defect to
  fix, not preserve. Also ensure the app has **≥2 project-scoped spaces**.

More than these floors is better. Fan the work across the subagents listed below.

{{include:prompt.common.md}}

Begin now with Phase 0.
