# PROGRESS — scenario-campaign · task `06-tanzania` · round 17

_Started 2026-07-16T06:02:48.764Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->
- Read the cross-round ledger, scenario contract, and current round context; confirmed R17's narrow goal is a clean step-2 verification under the intentionally loosened partition expectation.
- Rebuilt `@lmthing/cli...` so the fresh local server adopts the existing uncommitted system-space changes.
- Replayed steps 1–2. Step 1 passed. Step 2 created four source-grounded specialist spaces and four populated tables without web research, but failed the served-app assertion: `pageCount: 0`, `built: false`, plus automator recovered typecheck error (`itineraryTable` unavailable). Stopped the runner at the first failure.
- Attributed the failure to the automator's model-driven multi-turn freeform path: the trace wrote tables, then lost `itineraryTable` across statements, created APIs, and never reached page writes. Added the lowest reliable structural fix: `automator#build_live_project`, a three-node deterministic source-read → live-data → openable-app tasklist, and routed the organizer to that explicit action; updated DAG coverage and source-of-truth docs.

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- `automation/instances/scenario-campaign/attempts/06-tanzania.md` — required cross-round rung history and R17 direction.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — scenario steps and expectations.
- `automation/instances/scenario-campaign/rounds/17/06-tanzania/PROGRESS.md` — current-round execution log.
- `org/docs/system-spaces/README.md` — documentation diff accompanying existing system-space changes.
- `sdk/org/libs/core/system-spaces/{user-thing,system-architect}/...` — inspected existing uncommitted L1/L2 changes before replay.
