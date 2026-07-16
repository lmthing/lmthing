# PROGRESS — scenario-campaign · task `06-tanzania` · round 16

_Started 2026-07-16T04:17:01.563Z. The agent MUST update this file at every step._

## Steps

- Read the cross-round ledger and scenario; rebuilt `@lmthing/cli`.
- Clean replay through step 2 failed: the catalog app-architect path created no project tables or pages.
- Replaced the organizer's catalog handoff with the live-project automator, added its DAG assertion, and updated the system-spaces documentation.
- Unit tests passed (29 tests); a fresh replay through step 2 created `costs` (9 rows), `memories` (2), `stops` (12), `tariffs` (4), plus four pages and corresponding APIs.
- Step 2 remains failed because inventory still emitted cross-cutting facets rather than independently owned segments; stopped after the first failure.

## Files added to context

- `automation/instances/scenario-campaign/attempts/06-tanzania.md` — prior-rung history and escalation directions.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — step expectations.
- `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/03-build_app.md` — app-handoff source.
- `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/01-inventory.md` — failing partition rule.
- `sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md` — live-project writer contract.
- `rounds/16/06-tanzania/verify-step-02*/step-02{,.full}.json` — failing and verifying replay evidence.
- `org/docs/system-spaces/README.md` and `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts` — matching documentation and regression coverage.
