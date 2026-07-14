# PROGRESS — scenario-campaign · task `05-latam` · round 1

_Started 2026-07-14T16:47:48.809Z. The agent MUST update this file at every step._

## Steps

- Oriented against the complete 05-latam specification; confirmed `run.mjs` and generated results are absent, so round 1 requires a new runner.
- Located the previously committed 16-Act runner in sdk/org history (`2a663f7`), verified it matches the current Acts table, restored it verbatim, and syntax-checked it under the local target.
- Started the shared local `lmthing serve`, provisioned the local scenario identity, and ran the harness smoke test successfully (projects, store catalog, and a real THING turn all passed).
- Ran baseline Act I locally. The offer-before-authoring contract passed: THING offered an openable surface, asked a question, did not author or delegate a build before consent, and the plain "yes please" proceeded. The Act incorrectly failed on recoverable retry telemetry despite the campaign's hard requirement being zero *unrecovered* errors; strengthened the runner to check `attempt < ThingSession.MAX_RETRIES` and preserve recovered errors as an explicit metric. Added a prompt-contract test pinning the shared general rule that a decision/offer must end with the question and wait.

## Files added to context

- `sdk/org/scenarios/05-latam/scenario.md` — authoritative 16-Act scenario specification and acceptance criteria.
- `sdk/org/scenarios/README.md` — scenario harness orientation.
- `sdk/org/scenarios/_template/run.mjs` — runner hardening scaffold.
- `sdk/org/scenarios/harness/lib/pod.mjs` — pod, app, upload, and lifecycle assertions.
- `sdk/org/scenarios/harness/lib/thing.mjs` — session trace, consent, attachment, and error semantics.
- `sdk/org/scenarios/harness/lib/report.mjs` — results/report output semantics.
- `automation/instances/scenario-campaign/rounds/1/05-latam/PROGRESS.md` — mandatory per-run progress ledger.
- Historical `sdk/org@2a663f7:scenarios/05-latam/run.mjs` — previously authored executable implementation matching the 16 current Acts.
- Historical `sdk/org@2a663f7:scenarios/05-latam/results/report.md` — prior partial-run outcome and regression context.
- `sdk/org/scenarios/05-latam/fixtures/links.md` — fixture provenance and unique-token requirements.
- `sdk/org/scenarios/harness/provision.mjs` — local-target provisioning behavior.
- `sdk/org/scenarios/harness/lib/local.mjs` — shared local server lifecycle and location.
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — current shared THING triage judgment, especially the offer-before-authoring rule.
- `sdk/org/libs/core/src/spaces/system.test.ts` — existing prompt-contract tests and the no-overfitting guard.
- sdk/org historical commits `3ceb32c`, `9ad4ff8`, and `11a9396` — previous proposal-flow fixes and their evidence.
