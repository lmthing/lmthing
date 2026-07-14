# PROGRESS — scenario-campaign · task `08-small-shop` · round 1

_Started 2026-07-14T16:39:35.010Z. The agent MUST update this file at every step._

## Steps

- Oriented on the authored 08-small-shop scenario; confirmed it specifies Acts I–XIV but has no `run.mjs` or generated results yet.
- Found that the campaign reset intentionally deleted every runner, template runner, and harness module; identified the last 08 runner implementation (`180eebd`) and post-hardening harness revision (`5efc655`) in `sdk/org` history for restoration and comparison.

## Files added to context

- `sdk/org/scenarios/08-small-shop/scenario.md` — authored user flow, contracts, choreography, and executable Act table.
- `sdk/org/scenarios/README.md` — scenario harness overview and runner conventions.
- `automation/instances/scenario-campaign/rounds/1/08-small-shop/PROGRESS.md` — mandatory per-run progress ledger.
