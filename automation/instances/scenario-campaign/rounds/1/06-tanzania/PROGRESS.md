# PROGRESS — scenario-campaign · task `06-tanzania` · round 1

_Started 2026-07-13T19:45:55.831Z. The agent MUST update this file at every step._

## Steps

- **Oriented.** `sdk/org/scenarios/06-tanzania/scenario.md` is fully authored (6 sections, 14 Acts,
  5 real fixtures already committed: md + jpg + pdf + xlsx + mp3). `run.mjs` did NOT exist → round-1
  job is to implement it 1:1 from the spec, not to re-author the story.
- **Verified the fixture tokens are real & disjoint** — dumped `trip-costs.xlsx` (2 sheets: `legs`,
  `costs`; the grand-total cell really is `3344.2`), read `voice-memo.txt` (Emmanuel + the
  5,000-shilling ranger tip), `tanzaniamemories.md` (flight ref `ZZJQUU`), `links.md` (the 92-day
  Zanzibar-insurance validity window — the research target, in no fixture).
- **Checked the product surfaces each Act asserts on** before writing them: `db.query`'s `include`
  (`libs/cli/src/app/store.ts` `expandIncludes`), the api `HttpError` contract + worker crash
  boundary (`libs/cli/src/app/api/errors.ts`, `worker.ts`), file-based api routing (`api/<route>/GET.ts`,
  `loader.ts`), `@app/runtime` handler imports (`handler-module.ts`), `fork_queue` trace events
  (`libs/core/src/fork/fork.ts:170`), relation schema (`libs/core/src/db/schema.ts`), and the space-file
  REST route (`GET /api/projects/:id/spaces/:sid/files` → `Record<path,content>`) used for the
  "token landed in a space file" assertions.
- **Wrote `sdk/org/scenarios/06-tanzania/run.mjs`** — all 14 Acts, 1:1 with the spec's Acts table.
  Keeps every hardening pattern: per-Act checkpoint + `--acts=`, keepalive pinger, resilient send
  (survives a pod roll), scripted `onAsk` (consent approved, any other ask settled with `{}`),
  trace/real-state-only assertions. The real-state helpers read db rows AND every project space file,
  so a fixture token is proven where it was actually written, never in prose. Syntax-checked.

## Files added to context

- `sdk/org/scenarios/06-tanzania/scenario.md` — the spec the runner must implement 1:1.
- `sdk/org/scenarios/06-tanzania/fixtures/links.md`, `tanzaniamemories.md`, `voice-memo.txt` — the
  unique tokens each Act must find in real state.
- `sdk/org/scenarios/_template/run.mjs` — the hardening baseline to start from.
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs`, `provision.mjs`, `lib/paths.mjs` — the API
  the runner drives (uploads + mediaType routing, WS attachment path, trace-derived turn facts).
- `sdk/org/libs/cli/src/app/api/{errors,loader,handler-module,worker}.ts` — the crash-boundary + route
  contract Act VIII asserts.
- `sdk/org/libs/cli/src/app/store.ts` (`query`/`expandIncludes`), `libs/core/src/db/schema.ts` — the
  `include` relation feature Act IV asserts.
- `sdk/org/libs/core/src/fork/fork.ts` — the `fork_queue {active,queued,max}` events Act VII asserts.
- `sdk/org/libs/cli/src/server/routes/{projects,fs}.ts` — the file/space read routes the real-state
  helpers use.
- git history `4587aee^:scenarios/06-tanzania/run.mjs` — the pre-rewrite runner, for the hardening
  patterns it had already learned.
