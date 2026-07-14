# PROGRESS — scenario-campaign · task `09-home-renovation` · round 1

_Started 2026-07-14T17:05:44.387Z. The agent MUST update this file at every step._

## Steps

- Oriented on the authored scenario, fixtures, harness API, and empty runner/results state; confirmed round 1 needs the executable runner built from the template.
- Read fixture provenance, THING’s current triage instructions, local provisioning/server entrypoints, and a mature sibling runner to reuse only established harness patterns.
- Started the shared local pod, provisioned the local scenario lane, and ran the harness smoke check before writing or executing Acts.
- Implemented the first runner section: checkpointing, session recovery, multi-modal upload and real-state fixture assertions, baseline offer/build, app/API checks, research, custom UI, ask dismissal, and large-value inspection.
- Completed the checkpointed runner for all fifteen authored baseline Acts (cost form/alert, cron, growth, schema safety, ledger, inbound, updates, memory, restart) and prepared the first foreground baseline run.

## Files added to context

- `sdk/org/scenarios/09-home-renovation/scenario.md` — authored six-section scenario specification and Acts I–XV acceptance contract.
- `sdk/org/scenarios/README.md` — scenario runner/harness orientation.
- `sdk/org/scenarios/_template/run.mjs` — required resilient runner/checkpoint scaffold.
- `sdk/org/scenarios/harness/lib/pod.mjs` — local pod, app, upload, event, and ledger API surface.
- `sdk/org/scenarios/harness/lib/thing.mjs` — trace-derived assertions, asks, attachment dispatch, and session resilience behavior.
- `sdk/org/scenarios/harness/lib/report.mjs` — report/checkpoint result rendering contract.
- `sdk/org/scenarios/09-home-renovation/fixtures/links.md` — unique fixture tokens and live research provenance.
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — current shared THING triage behavior for offer-before-authoring and fixture handoff.
- `sdk/org/scenarios/harness/provision.mjs` — local-target provisioning behavior.
- `sdk/org/scenarios/harness/local-server.mjs` — local rebuild/restart lifecycle entrypoint.
- `sdk/org/scenarios/06-tanzania/run.mjs` — mature runner patterns for live app and trace assertions.
- `sdk/org/scenarios/05-latam/run.mjs` — event-emitter trace settlement patterns.
- `sdk/org/libs/**` ask route search — cancellation API implementation location.
- `sdk/org/libs/cli/src/web/agent-api.ts` — verified the `DELETE /api/ask/:id` cancellation route shape.
- `sdk/org/scenarios/09-home-renovation/run.mjs` — newly authored executable scenario runner.

