# PROGRESS — scenario-campaign · task `06-tanzania` · round 1

_Started 2026-07-14T16:47:48.840Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->
- 2026-07-14: Oriented on the Tanzania specification, fixture provenance, runner template, and local harness APIs. Confirmed `run.mjs` and generated results are absent; the existing spec declares Acts I–XVII and needs an executable runner.
- 2026-07-14: Recovered and syntax-checked the last audited 17-Act runner from `sdk/org` history. Audited it against the current spec; identified that Act XIV still needs in-run real Chrome verification rather than merely emitting a browser handoff.
- 2026-07-14: Started/attached to the local pod and ran the harness smoke test. Provisioning, catalog reads, and a real THING turn passed (27.1 seconds; three LLM calls).
- 2026-07-14: Ran baseline Act I locally. All five inputs were correctly routed; THING offered an organized, openable result citing four real specifics with zero premature authoring/building yields. Duration 189s; two recovered file-reader typecheck slips were recorded as retry metrics.
- 2026-07-14: Triaged the recovered reader/sheet typecheck slips as raw document/spreadsheet content leaking into generated TypeScript. Added a general system-space instruction to synthesize source data rather than paste it as code, with a prompt-contract regression test; validation is running before rebuild/restart.
- 2026-07-14: Rebuilt/restarted and re-ran Act I. Reader/sheet raw-content syntax slips stopped, but THING failed to offer because it referenced delegate results in a later evaluator statement (`readerAnswer` / `sheetAnswer` unavailable). The Act is honestly failing pending a surgical prompt/runtime-safe composition fix.

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- `sdk/org/scenarios/06-tanzania/scenario.md` — authoritative story, Acts, expected runtime evidence, and app contract.
- `sdk/org/scenarios/06-tanzania/fixtures/links.md` — fixture provenance and unique state-assertion tokens.
- `sdk/org/scenarios/README.md` — scenario runner conventions.
- `sdk/org/scenarios/_template/run.mjs` — required runner hardening and helper patterns.
- `sdk/org/scenarios/harness/lib/{pod,thing,report,local}.mjs` — pod, session, report, and local-target APIs.
- `sdk/org/scenarios/harness/{provision,local-server}.mjs` — local provisioning and server lifecycle.
- `automation/instances/scenario-campaign/rounds/1/06-tanzania/PROGRESS.md` — required per-run ledger.
- `sdk/org` git history for `scenarios/06-tanzania/run.mjs` — recovered the prior 17-Act executable spec after the campaign artifact reset.
- `sdk/org/scenarios/06-tanzania/run.mjs` — recovered runner, audited against the current Acts table.
- `sdk/org/scenarios/harness/smoke.mjs` — verified the local harness's smoke contract.
- `sdk/org/scenarios/harness/.state/smoke-report.md` — local smoke outcome.
- `sdk/org/scenarios/06-tanzania/results/{checkpoint,report,trace}.json` / `.md` — local Act I trace and result.
- `sdk/org/libs/core/system-spaces/system-files/agents/{reader,sheet}/instruct.md` — prompt source for the recovered typecheck slips.
- `sdk/org/libs/core/src/spaces/prompt-contract.test.ts` — prompt regression-test convention.
- `sdk/org/scenarios/06-tanzania/results/{checkpoint,report,trace}.json` / `.md` — post-restart Act I failure evidence.
