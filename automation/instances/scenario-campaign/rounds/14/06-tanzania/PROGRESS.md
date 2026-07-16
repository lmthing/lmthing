# PROGRESS — scenario-campaign · task `06-tanzania` · round 14

_Started 2026-07-16T02:37:27.306Z. The agent MUST update this file at every step._

## Steps

- Step 1 PASS — attachment dispatch invoked files/vision readers; state remains empty (0 spaces, tables, and pages); offer evidence is in `attempt-1/step-01.full.json`. Recovered prose-only typecheck noise did not prevent the deliverable.
- Step 2 FAIL — organizer re-entered: 14 architect and 4 automator delegates produced seven overlapping spaces and `appManifest.built=false`; the 15-minute turn was interrupted. Stopped `attempt-1` and began caller attribution from compact/full evidence.
- L2 fix staged in source (uncommitted): `user-thing/thing#accepted-supplied-material-offer` now consumes the organizer envelope and writes its closing reply in the same statement, forbidding any continuation/re-entry. Added the `prompt-contract` regression test and updated `org/docs/system-spaces/README.md`; focused core tests and `pnpm docs:check` passed. Rebuilding before clean verification through step 2.
- Verification result: attempt-2 removed the original caller retry (4 architect + 1 automator) but partitioned on storage facets and left `built:false`. Added the L2 inventory operational-axis rule with DAG regression coverage; attempt-3's first fan-out reached bounded stages, but re-entered `organize_material` a second time (10 architect + 2 automator), ending with 7 overlapping spaces, one table, zero pages, and `built:false`. Stopped after the requested limited fresh attempts; report and R14 ledger entry record an unresolved L3 runtime completion/dedup candidate.

## Files added to context

- `automation/instances/scenario-campaign/attempts/06-tanzania.md` — cross-round attribution and escalation history.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — step expectations and invariant contract.
- `automation/instances/scenario-campaign/rounds/14/06-tanzania/PROGRESS.md` — round artifact log.
