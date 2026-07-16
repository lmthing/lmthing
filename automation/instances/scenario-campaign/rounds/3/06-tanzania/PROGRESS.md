# PROGRESS — scenario-campaign · task `06-tanzania` · round 3

_Started 2026-07-16T19:07:30.882Z. The agent MUST update this file at every step._

## Steps

- Read the scenario and cross-round ledger. Prior failures: R1 L1 appbuilder prompts and R2 L3 schema-derived upstream task-output DTS; neither produced a fully built app.
- Inspected the working tree: only the campaign ledger and the round artifact directory are modified/untracked; no product diff is currently present.
- Built `@lmthing/cli...` successfully so the clean local server will adopt current core and system-space sources.
- Starting a fresh local replay and judging compact step evidence in order.

## Files added to context

- `automation/instances/scenario-campaign/attempts/06-tanzania.md` — required cross-round attempt history.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — assertions and expected state for every step.
- `automation/instances/scenario-campaign/rounds/3/06-tanzania/PROGRESS.md` — campaign progress log.
- `automation/instances/scenario-campaign/rounds/3/06-tanzania/attempt-1/output.log` — prior invocation startup context.
- `automation/instances/scenario-campaign/rounds/3/06-tanzania/attempt-1/prompt.md` — prior invocation task specification.
