# PROGRESS — scenario-campaign · task `09-home-renovation` · round 1

_Started 2026-07-14T06:59:44.032Z. The agent MUST update this file at every step._

## Steps

- Oriented: read scenario.md (fully authored, 15 Acts I–XV + Edges — NOT a stub), _template/run.mjs,
  scenarios/README.md, fixtures (7 real artifacts present), harness libs (pod.mjs, thing.mjs,
  report.mjs, provision.mjs), and 08-small-shop/run.mjs as the freshest complete reference runner.
- Confirmed run.mjs does NOT yet exist for 09 → must scaffold from template + implement 1:1 with
  scenario.md §6 Acts table.
- Verified fixture tokens are real: "Septic King" ×2 in contractor-quote.pdf (~84K chars); cq2.pdf
  pdftotext empty (genuinely broken); workbook inline-string tokens Q-2210-GLAZE/BL-B05/CD-2026-XL7/
  XLS-RENO-V7 present.
- Located DELETE /api/sessions/:id/ask/:askId → cancelAsk (resolves null) in libs/cli/src/web/agent-api.ts.
- Wrote sdk/org/scenarios/09-home-renovation/run.mjs (Acts I–XV + Edges, 1:1 w/ scenario.md). Committed 5e77ce2.
- Provisioned disposable prod user homereno / user-381709327162959498. Smoke = PASS (prod healthy).
- Harness improvement (2cb3154): carry `attempt` through turn().errors; add ThingSession.unrecoveredErrors()
  + stats.unrecoveredErrors; runner now hard-fails only on UNRECOVERED errors (recovered = metric),
  matching the scenario's stated error policy. (Turn loop retries typecheck/eval up to maxRetries=3;
  attempt<3 = recovered, attempt>=3 = gave up.)
- Started Act I live (background). Turn 1: THING delegated to system-vision + system-files, read all
  docs, cq2.pdf observed unsupported. One RECOVERED typecheck_error on THING turn 1 (Promise→string
  cast). "yes please" → architect building spaces/fields/functions (recovered typecheck slips inside
  specialist forks, nodes end done). Running.
- Act I COMPLETED (10.3 min). PASSED: offer-before-build, cites ≥3 facts, ≥3 spaces (kitchen/bathroom/
  hallway), ≥1 seeded table, ALL memo tokens landed (padstone/VO114/Delta/Aegean — THING inlined them),
  vision facts, cq2 unsupported. FAILED: (a) app built:false / 0 pages; (b) file-sourced tokens
  Q-2207-KITCH/Hansson/Q-2210-GLAZE/Septic King NOT in state; (c) 20 total errors (mostly recovered).
- TRIAGE — two real product bugs:
  * BUG 1 (headline): THING passed the REAL upload ids to the automator, but ingestUserTurn cleared
    pendingAttachments each turn, so in turn 2 (the "yes please" build turn) those ids no longer
    resolved → the automator got NO attachment note → it fabricated a placeholder id
    "attachment-budget-xlsx" → readDocument read nothing → budget/quotes tables created EMPTY. The
    two-turn propose→consent→build flow is fundamentally incompatible with per-turn attachment clearing.
    FIX (core/session/session.ts, commit 20b2038): accumulate pendingAttachments across the session.
    Regression test added (attachments-core.test.ts): a file attached in turn 1 resolves when a LATER
    turn delegates it — verified it FAILS with the clear restored, PASSES without.
  * BUG 2: the automator built 7 tables but ZERO pages (app not openable — empty-app failure), despite
    THING's query explicitly asking for a "budget-vs-actual dashboard". FIX (system-appbuilder/automator
    instruct, commit 68e4957): definition-of-done gate — an app the user OPENS isn't done until it
    serves at least one page backed by an API reading real rows; never report "app built" on tables
    with zero pages. Generalized principle (no scenario literals), scoped to first build.
- Harness: recovered/unrecovered error classification (commit 2cb3154) so Edges hard-fails only on
  UNRECOVERED (attempt>=maxRetries), recovered slips are a metric.
- Built @lmthing/core OK. Pushed submodule 68e4957 + parent pointer 1604a73c → CI building compute:1604a73.
  Awaiting build to deploy to test pod (user-381709327162959498) and re-run Act I fresh.

## Files added to context (cont.)

- libs/core/system-spaces/user-thing/agents/thing/instruct.md — THING triage brain; confirmed strong
  "OFFER — do not wait to be asked" section (L302-314) already grounds Act I's propose behavior.
- libs/core/src/eval/turn-loop.ts — retry/recovery semantics (maxRetries=3; attempt>=3 → return 'error').
- libs/core/src/web/agent-api.ts — ask POST/DELETE routes.

## Files added to context

- sdk/org/scenarios/09-home-renovation/scenario.md — the spec (6 sections + Acts I–XV + Edges).
- sdk/org/scenarios/_template/run.mjs — runner scaffold with hardening patterns.
- sdk/org/scenarios/README.md — harness overview.
- sdk/org/scenarios/harness/lib/{thing,pod,report}.mjs — harness API (ThingSession, Pod, Report).
- sdk/org/scenarios/harness/provision.mjs — getUser().
- sdk/org/scenarios/08-small-shop/run.mjs — freshest complete reference runner (all patterns).
- sdk/org/scenarios/09-home-renovation/fixtures/{links.md,voice-memo.txt,reno-dump.md} — fixture facts/tokens.
