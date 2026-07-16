# PROGRESS — scenario-campaign · task `06-tanzania` · round 15

_Started 2026-07-16T03:29:54.014Z. The agent MUST update this file at every step._

## Steps

- Read the cross-round ledger and existing uncommitted SDK diff; step 2 is the first outstanding failure, with the organizer-envelope change awaiting a clean verification.
- Rebuilt `@lmthing/cli` so the local server adopts the current system-space source.
- Starting a fresh replay from step 1 and will stop at the first failed judgement.
- Judged step 1 PASS: all attachment readers ran, the offer cited real details, and state remained empty.
- Judged step 2 FAIL: the organizer ran twice (11 architect and 2 automator delegates), yielding eight overlapping spaces and `appManifest.built=false`. The first run finished, then THING inspected partial state and re-entered the organizer.
- Applied an L1 general workflow-envelope contract: after a workflow returns its envelope, THING reports that outcome rather than independently re-inspecting partial builder state or restarting work. Added the matching prompt-contract assertion and system-spaces documentation.
- Fresh L1 verification removed the re-entry (one organizer, one architect, one appbuilder delegate) but still failed: the direct automator resolved after a survey-only typecheck error, leaving zero tables and pages. This proves the remaining gap is structural, not another routing sentence.
- Applied L2: `organize_material/build_app` now delegates to `app-architect#build_app`, whose action tasklist has the deterministic design → file-by-file authoring → finalize boundary, instead of the broad direct automator. Updated the DAG assertion and documentation.
- Final fresh replay through step 2 still failed. Step 1 passed; step 2 now has exactly one organizer, four correct leg specialists, and exactly one `app-architect#build_app` delegate, but its nested build tasklist returned before project creation or any authoring (`appTables: {}`, `pageCount: 0`, `built: false`). Stopping after the allowed two verification attempts; reporting the remaining structural handoff failure honestly.

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
