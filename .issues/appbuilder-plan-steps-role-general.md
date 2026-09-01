# spaces: seven build_live_project planning steps grant writers via `role: general` while prose says "no writers"

**Symptom:** the rule (stated in `org/docs/system-spaces/README.md:335`,
`runtime-globals/README.md:393`, `fork-and-tasklists.md:208`) is "never forbid a tool in prose —
disable it structurally". Seven planning nodes of the automator's `build_live_project` tasklist
declare `role: general` — so `db:schema`/`pages:write`/`api:write`/`hooks:write` writer globals ARE
injected — while their prose says "THINKING step — no writers": `02-user_stories.md`,
`03-plan_app.md`, `04-plan_tables.md`, `05-plan_endpoints.md`, `06-plan_components.md`,
`07-plan_pages.md`, `07a-plan_automations.md`. A plan node can silently write a half-formed table
before the binding plan exists, on the product's most expensive pipeline. Step `01-read_sources.md`
does it correctly (`role: explore`).

**Direction:** set `role: plan` on all seven (one line each). Softer instance of the same pattern:
`user-memory/agents/memory/instruct.md:21-24` relies on prose alone to keep `db:write` unused on
ordinary turns.

**Where:** `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/`.
