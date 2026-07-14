# PROGRESS — scenario-campaign · task `08-small-shop` · round 1

_Started 2026-07-14T16:47:48.898Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->
- 2026-07-14: Oriented against the scenario specification, runner template, harness session/pod/report APIs, and current repository state; confirmed `08-small-shop/run.mjs` is absent.

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- `sdk/org/scenarios/08-small-shop/scenario.md` — authoritative 14-Act baseline specification.
- `sdk/org/scenarios/README.md` — scenario/harness orientation.
- `sdk/org/scenarios/_template/run.mjs` — required runner hardening scaffold.
- `sdk/org/scenarios/harness/lib/pod.mjs` — pod, app, event, upload, and lifecycle APIs.
- `sdk/org/scenarios/harness/lib/thing.mjs` — session behavior, trace assertions, and recovered-error semantics.
- `sdk/org/scenarios/harness/lib/report.mjs` — report/checkpoint output contract.
- `automation/instances/scenario-campaign/rounds/1/08-small-shop/PROGRESS.md` — mandated per-run log.
- `sdk/org/scenarios/08-small-shop/fixtures/links.md` — approved live-research sources.
- `sdk/org/scenarios/08-small-shop/fixtures/voice-memo.txt` — audio fixture's verified normalized transcription facts.
- `sdk/org/scenarios/08-small-shop/fixtures/{inventory.csv,sales-ledger.xlsx,supplier-invoice.pdf}` — verified unique source tokens for real-state assertions.
- `sdk/org/scenarios/05-latam/run.mjs` and `sdk/org/scenarios/06-tanzania/run.mjs` — hardened multi-Act runner patterns.
- `sdk/org/scenarios/harness/provision.mjs` and `local-server.mjs` — local target provisioning/server lifecycle.
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — THING triage and offer/build policy.
- `sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md` — live-project authoring contract.
- `store/spaces/{integration-demo,integration-whatsapp}/` — catalog integration definitions used by baseline Acts.

- 2026-07-14: Verified fixture tokens and source integration locations; selected baseline runner architecture from the established 05/06 runners.

