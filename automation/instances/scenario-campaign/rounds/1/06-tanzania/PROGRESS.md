# PROGRESS — scenario-campaign · task `06-tanzania` · round 1

_Started 2026-07-14T16:39:34.952Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->
- Oriented against the Tanzania specification; confirmed it is complete rather than a stub and that its round-one runner and generated results are absent.
- Located the scenario fixtures and verified the expected five baseline inputs plus the later museum scan are present.
- Discovered the campaign reset commit deleted every runner, template runner, harness module, and generated result; located the complete compatible implementation in the prior `0229f29` tree for recovery.
- Restored the harness, template, Tanzania runner, and prior result artifacts from `0229f29`; patched the Tanzania runner to avoid production-only environment/readiness calls when `SCENARIO_TARGET=local`.

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- `sdk/org/scenarios/06-tanzania/scenario.md` — authoritative scenario contract and Act table.
- `sdk/org/scenarios/README.md` — scenario and harness orientation.
- `automation/instances/scenario-campaign/rounds/1/06-tanzania/PROGRESS.md` — mandatory per-run ledger.
