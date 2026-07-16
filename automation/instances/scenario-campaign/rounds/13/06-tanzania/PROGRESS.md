# PROGRESS — scenario-campaign · task `06-tanzania` · round 13

_Started 2026-07-16T02:03:45.100Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->
- Read the attempt ledger, current scenario, and existing organizer diffs; confirmed R12's prescribed L2 node-contract diagnosis.
- Reworked `organize_material`: inventory reads attachments in a prelude, while specialist and app nodes each delegate and resolve in one self-contained statement; added DAG contract assertions.
- Built CLI, ran core typecheck and organizer DAG test, then fresh-replayed through step 2. Step 1 passed; step 2 remains failing (9 overlapping spaces and `appManifest.built=false`). Wrote `report.md` and appended the attempt ledger.

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- `automation/instances/scenario-campaign/attempts/06-tanzania.md` — cross-round attribution and escalation history.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — step assertions and scenario boundary.
- `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/{01-inventory,02-build_specialist,03-build_app,index}.md` — organizer implementation.
- `sdk/org/libs/core/src/tasklist/orchestrator.ts` — task prelude and per-statement execution semantics.
- `sdk/org/libs/core/system-spaces/system-research/tasklists/deep_research/{01-scope,03-investigate}.md` — established prelude pattern.
- `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts` — structural validation coverage.
