# PROGRESS — scenario-campaign · task `06-tanzania` · round 12

_Started 2026-07-16T01:08:24.206Z. The agent MUST update this file at every step._

## Steps

- Read the 06-tanzania attempt ledger, scenario, round artifacts, and existing uncommitted implementation diff; step 2 is the active, previously attributed issue.
- Built the local CLI and ran clean attempt 2 through step 2. Step 1 passed; step 2 failed because THING delegated only to `system-appbuilder/automator`, leaving zero specialist spaces.
- Attributed the failure to the remaining competing supplied-material build path in THING's prompt, strengthened the organizer-only contract, added a regression assertion, ran targeted tests, and rebuilt the CLI.
- Fresh attempt 3 passed step 1 and used `organize_material` for step 2, but still failed step 2: all four required leg scopes were present, yet the inventory over-fragmented into 11 spaces and the app manifest remained `built: false`.
- Tightened the inventory rule to select a coarsest non-overlapping operational partition, rebuilt, and ran final fresh attempt 4 through step 2. It still failed: the organizer produced 8 off-partition specialists and one unserved `itinerary` table (`pageCount: 0`, `built: false`).
- Appended the honest L1 FAIL result to the attempt ledger and updated the round report with all four attempts, tests, and next diagnosis.

## Files added to context

- `automation/instances/scenario-campaign/attempts/06-tanzania.md` — authoritative prior-attempt ladder and escalation directions.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — expectations to judge.
- `automation/instances/scenario-campaign/rounds/12/06-tanzania/attempt-1/{output.log,prompt.md}` — inherited round state.
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — supplied-material routing under test.
- `sdk/org/libs/core/system-spaces/system-architect/agents/architect/instruct.md` — unverified action-runtime contract change.
- `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/*` — existing deterministic organizer.
- `sdk/org/libs/core/src/spaces/{prompt-contract,system-spaces-dag}.test.ts` — regression coverage for existing changes.
- `automation/instances/scenario-campaign/config.mjs` — campaign target and report contract.
