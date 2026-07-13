# PROGRESS — scenario-campaign · task `05-latam` · round 1

_Started 2026-07-13T19:45:55.803Z. The agent MUST update this file at every step._

## Steps

- **Orient.** `05-latam/` has a fully-authored `scenario.md` (13 Acts, 6 sections, feature checklist)
  + 6 fixtures, but **no `run.mjs`** (deleted campaign-wide). Round-1 job = implement the runner 1:1
  from the spec, not re-author the story.
- **Harness read.** `provision.mjs`, `lib/{pod,thing,report,gateway,paths}.mjs`, `_template/run.mjs`.
  The Pod client already exposes everything the 13 Acts need (`runEmitter`, `readProjectFile`/
  `writeFile`, `appApi`/`appPage`, `listIntegrations`, `inbound`, `upload`, `restart`).
- **Grounded the never-tested capabilities** (Explore sweep over `org/docs` + core/cli source):
  space tasklists (`tasklists/<slug>/NN-<id>.md`; `dependsOn`/`forEach`/`condition`/`optional`/`goal`),
  the degraded `TaskEnvelope` (`orchestrator.ts:339`), cron `ctx.state` → `.data/emitter-state.json`,
  the `@emitter:<scope>:<name>` run route, the 2-part vs 3-part `loadKnowledge` preload split
  (`system-block.ts#resolvePreloadedKnowledge`), `maxHistoryTurns: 20` ⇒ summarize at **>40
  messages**, the `[CONTEXT SUMMARY]` prefix (`history.ts`), and `yield_resolved{kind,value}` — the
  trace event that carries the tasklist envelope Act X must read.
- **Provisioned** the disposable prod user: `latam-mrh4xr6i@lmthing.test` / `user-381387982222943882`.
- **Confirmed the product can author all of it**: `system-architect/functions/` has `writeTaskFile`
  (which takes `forEach`/`condition`/`optional`/`goal`/`dependsOn`), `writeEventFile`, `writeHookFile`.
  ⚠️ But the architect's `instruct.md` (92 lines) **never mentions** forEach/condition/optional/
  dependsOn — a likely Act IX/X failure (prompt gap, not an engine gap). Prediction recorded before
  the run.
- **Wrote `sdk/org/scenarios/05-latam/run.mjs`** (13 Acts, 1:1 with the Acts table) and committed it
  (sdk/org `d057fab`). Two new helpers the never-tested Acts need:
  - `grepFs()` — `/api/fs/tree` returns **paths only**, so the template's "grep the tree JSON" token
    check proves nothing; this reads the bytes and greps content.
  - `fireAndTrace()` — a cron/hook/tasklist runs **headless in its own session**, so its
    `node_end`/`yield_resolved` events never appear in THING's stream. Snapshot the session list,
    fire, drain what appears.
- **Smoke test green** against prod (store catalog 13 spaces, a real THING turn in 8.2 s, 0 errors).
- **Act I running live** (opener + attachment → offer; "yes please"; the $9,000 ceiling turn).

## Files added to context

- `sdk/org/scenarios/05-latam/scenario.md` — the spec I must implement 1:1 (13 Acts).
- `sdk/org/scenarios/05-latam/fixtures/links.md` — provenance + the 5 disjoint fixture tokens
  (`Wild Rover`, `2016-02-04`, `Huchuypicchu`, `Torres del Paine`, `Churuquella`).
- `sdk/org/scenarios/05-latam/fixtures/{trip-notes.md,voice-memo.txt}` + a dump of
  `trip-budget.xlsx` — needed the REAL row counts/values to write honest assertions (legs sheet has
  20 rows; Sucre `nights` is blank; El Calafate = 3 nights; Buenos Aires = 6 nights).
- `sdk/org/scenarios/_template/run.mjs` — the hardening baseline every Act must keep.
- `sdk/org/scenarios/harness/lib/{pod,thing,report,gateway,paths}.mjs`, `provision.mjs` — the exact
  harness API the Acts assert through.
- `sdk/org/libs/cli/src/server/routes/fs.ts` — proves `/api/fs/tree` is `{files:[paths]}` (no
  content) → why `grepFs()` exists.
- `sdk/org/libs/core/src/sandbox/trace.ts` — the `TraceEvent` union: `yield_resolved{kind,value}`
  (Act X's degraded envelope) and `node_end{status:'done'|'error'|'skipped'}` (Act IX's Brazil skip).
- `store/spaces/integration-demo/{package.json,events/messages.ts,functions/demoSendMessage.ts}` —
  Act VII's install target: HMAC `x-demo-signature`, `INTEGRATION_DEMO_{BASE_URL,API_TOKEN,WEBHOOK_SECRET}`.
- `sdk/org/libs/core/system-spaces/system-architect/{functions/writeTaskFile.ts,agents/architect/instruct.md}`
  — the DAG-authoring capability exists in the function but is absent from the prompt.
