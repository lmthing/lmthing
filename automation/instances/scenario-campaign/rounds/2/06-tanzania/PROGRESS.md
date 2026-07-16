# PROGRESS — scenario-campaign · task `06-tanzania` · round 2

_Started 2026-07-16T18:16:44.131Z. The agent MUST update this file at every step._

## Steps

- Read the scenario, attempt ledger, and round progress before replaying.
- Rebuilt the CLI and launched a fresh local replay; judged step 01 PASS from `step-01.json`: vision/files delegates, no errors, and zero spaces/tables/pages before the offer.
- Judged step 02 FAIL from `step-02.json`: three specialists and 24 rows were created without research, but endpoint typecheck errors (`Parameter 't' implicitly has an 'any' type`) left the app manifest `built: false`; stopped the runner at the first failure.
- Attributed this as L3 after the ledger's three ineffective L1 attempts and a trace showing the callback received `plan_tables: any`; added schema-derived upstream DTS, a passing/revert-failing regression test, rebuilt core/CLI, and passed `pnpm docs:check`.
- Fresh replay through step 02 removed the original endpoint `t` diagnostic, but the app remained `built: false` due independent model statements (`console`, malformed `as const`, a page import callback over `item: any`, and an invalid generated source string). Expanded the same L3 ambient typing to `forEach` items with another load-bearing test, but stopped after the second failed scenario replay rather than claim a full fix.

## Files added to context

- `automation/instances/scenario-campaign/attempts/06-tanzania.md` — required cross-round rung history.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — step expectations and invariants.
- `automation/instances/scenario-campaign/rounds/2/06-tanzania/PROGRESS.md` — current round record.
