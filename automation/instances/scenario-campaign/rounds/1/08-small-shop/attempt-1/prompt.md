# Scenario campaign — `08-small-shop` · round 1 (BASELINE + FIRST NEW ACTS)

This is the **first round** for `08-small-shop`. Two goals, in order:

**1. Reach a green baseline.**
- Read `sdk/org/scenarios/08-small-shop/scenario.md`. If `sdk/org/scenarios/08-small-shop/run.mjs` does **not** exist yet, scaffold it from
  `sdk/org/scenarios/_template/run.mjs` and implement the Acts already described in `sdk/org/scenarios/08-small-shop/scenario.md`
  (1:1 with its Acts table), reproducing the literal user flow. If it exists, read it and confirm its
  Acts still match `sdk/org/scenarios/08-small-shop/scenario.md`.
- If `sdk/org/scenarios/08-small-shop/scenario.md` itself is a stub (some scenarios only have a title/idea — check
  `sdk/org/scenarios/IDEAS.md` and the `_template/scenario.md` structure), first author the six
  sections into a coherent, realistic scenario with a small initial set of Acts, then build its
  runner.
- Provision a disposable prod user and run the baseline Acts end-to-end **live** until they pass (or
  are honestly recorded as failing with a triaged cause). Fix any product bug you hit, with a test.

**2. Add a FIRST batch of additional Acts (2–4).**
- Choose them from the feature catalog below — capabilities `08-small-shop` does **not** yet cover
  — extending the scenario naturally (same persona, same growing project, realistic drift).
- Add each new Act to `sdk/org/scenarios/08-small-shop/scenario.md`'s Acts table (+ any new user stories / expectations) AND to
  `sdk/org/scenarios/08-small-shop/run.mjs` (1:1), keeping every hardening pattern. Run the FULL scenario (old + new) live,
  triage, fix in the product with a test, verify live, and report.

Everything about how to do this — the artifact format, the feature catalog, the harness API and
hardening patterns, the run/triage/fix/verify/report loop, and the commit discipline — is below.

<!--
  prompt.common.md — shared body for the scenario-campaign instance. Included by prompt.first.md
  (round 1: baseline + first new Acts) and prompt.next.md (round >= 2: add more Acts). This file
  embeds the full process + format knowledge that used to live in sdk/org/scenarios/PLAYBOOK.md and
  SCENARIO-FORMAT.md (both DELETED) — it is the authoritative spec for this work now.
-->

You are running **fully autonomously and non-interactively** (headless). No human will answer
questions during this run, so **never stop to ask** — make the best reasonable decision, record
your assumptions, and keep going until the goal for this run is reached or you hit a hard blocker
you cannot work around. This task fires again on a schedule, so if you run out of budget/time,
leave everything in a clean, committed, resumable state.

- **Scenario:** `08-small-shop` (`sdk/org/scenarios/08-small-shop`)  ·  **Round:** 1 — BASELINE + FIRST NEW ACTS  ·  **Branch:** `main`

**Working directory:** you start at the **lmthing monorepo root** and have the **whole monorepo** in
scope — both the parent repo and the `sdk/org` submodule. You will commit + push **both** (submodule
first, then the parent pointer) to trigger CI, and you must **verify the deploy actually lands**
(image built, pod upgraded, feature live), not merely that the push succeeded. Scenario files live at
`sdk/org/scenarios/08-small-shop`; the harness at `sdk/org/scenarios/harness/`.

## The mission

Extend `08-small-shop` with **additional Acts**, run the **whole scenario end-to-end against LIVE
production**, triage every failure, **fix real product bugs in the product (with a test)**, verify
the fix live, and **report honestly**. A scenario is not a feature test — it is a **promise,
exercised end-to-end through the THING agent against live prod, and asserted on real system state**
(the execution trace of what the agent did, and the actual spaces / app / database rows it
produced). The most valuable output is the **honest narrative of where the product broke down**, not
a green checkmark. A scenario that only grades the model's prose passes when the system is broken —
never assert on prose.

## Fan-out (subagents)

(none — run this task in a single session without fanning out)

## The scenario artifact (what you are editing)

A scenario is TWO files plus generated results, all under `sdk/org/scenarios/08-small-shop`:

```
scenario.md              # the SPEC + recorded results (structure below)
run.mjs                  # the executable runner (start from ../_template/run.mjs)
fixtures/…               # any input files (attachments, seed data) — self-contained
results/report.md        # generated: the Actual-results table
results/trace.json       # generated: the full execution trace (evidence)
results/checkpoint.json  # generated: per-Act resume state
```

`scenario.md` has SIX sections, in order (mirror `../_template/scenario.md`):
1. **One line + persona** — who the user is and the one sentence of what they're doing.
2. **The user flow** — the literal UI-level steps; quote each real message VERBATIM. This is what
   `run.mjs` reproduces.
3. **What the user expects (the contract)** — in the user's terms, a numbered list of what "it
   worked" means, plus **anti-expectations** (things that are a failure even if the chat looks fine:
   an empty app, a "noted!" with no DB change, data in the wrong project).
4. **What happens in the background (the choreography)** — the hop-by-hop system reality (upload →
   `system-files` → THING triage → delegate(s) → authoring writers → DB → event pipeline).
5. **User stories** — `As a <persona>, I want <capability>, so that <outcome>`, each with a concrete
   **acceptance signal** (the observable fact that proves it).
6. **Acceptance criteria (the Acts)** — the executable spec: a table mapping each **Act** to what it
   asserts (on the trace + real state) and which user stories it covers, then a **performance
   targets** table. `run.mjs`'s Acts MUST match this table 1:1.

Plus two trailing sections: **What this scenario is really testing**, and **Actual results** (pasted
from `results/report.md` after a run — the document is both plan and record).

## Feature catalog — draw every NEW Act from here

Pick additional Acts that exercise catalog capabilities `08-small-shop` does **not** yet cover.
Prefer a coherent slice end-to-end over an isolated call.

- **A. THING triage & routing** (`user-thing/agents/thing`): answer directly (no delegation);
  research (`system-research/researcher`, live `webSearch`/`webFetch`); build a specialist space
  (`build_specialist` → `system-architect`); build an app — **4a** in the live project
  (`system-appbuilder/automator`) vs **4b** a new catalog template (`app-architect/build_app`);
  write/fix code (`system-engineer`); remember (`user-memory`); install + automate an integration
  (`system-store/finder` → consent `installSpace` → `automator`). **Compound requests** (one message
  naming >1 deliverable must do EACH). **Provided-info shortcut** (build directly from attached/
  in-conversation material, skip deep research). **Restraint** (do NOT scaffold a heavyweight app on
  a vague opener; refuse a capability it lacks — e.g. "book me a flight"). **Multilingual** routing
  (don't key off English).
- **B. Spaces & runtime** — per-topic spaces (agent + knowledge), **live-registered** (delegatable
  with no restart), **no-clobber** on re-add; delegating INTO a built space. Globals:
  `display`/`ask`/`setSessionMeta`/`fork`/`delegate`/`tasklist`/`loadKnowledge`.
- **C. Event pipeline** — all four emitter kinds: `webhook` (HMAC/verify-before-emit), `cron`
  (`every`/`daily` + `ctx.state` cursor), `db` (synthetic `project/db.<table>.<event>`), `internal`
  (`integration-lmthing` signals). Event hooks: code `handler`-as-filter (0 LLM cost) vs agent
  `trigger`. Code nodes in space tasklists (`NN-<id>.ts`, `node` metadata, worker-isolated),
  `dependsOn`/`forEach`. Project functions. Loop guard (coalescing, depth cap, self-write/self-
  trigger exclusion, cooldown). Payload validation (undeclared/mistyped dropped). `emitEvent`.
- **D. Consent & capabilities** — `@consent` (host-enforced, **fails closed** in headless);
  `installSpace` consent card (approve AND deny AND every non-approval answer); capability gating at
  typecheck (`store:read/install`, `events:emit`, `db:read/write/schema`, `hooks:write`,
  `pages:write`, `api:write`, `connections:use`).
- **E. Store & integrations** — `storeSearch`/`storeInspect`; install a space from the catalog;
  `integration-*` messaging spaces; `callConnection` (gated, SSRF-pinned); inbound webhooks
  (`/api/inbound/<path>`, provider verify); the `integration-demo` provider-free test source.
- **F. Project-as-application** — the live writers `writeProjectTable(name, schema, rows?)` (seed
  known data), `writeProjectPage`, `writeProjectApi`, `writeProjectHook`, `writeProjectEvent`,
  `writeProjectFunction`; `db:write` for later updates; `POST /app/<id>/build` → compiled assets;
  serving at `/app/<id>/`; the app data API (`/api/projects/<id>/app/data/<table>`).
- **G. Attachments** (`system-files`/`system-vision`) — upload (`POST /api/uploads`); deliver WITH a
  message (WS path); `readDocument` (text/markdown/pdf); hand an attachment to a specialist via
  `attachmentIds`; vision for images, transcription for audio.
- **H. Pod lifecycle & resilience** — restart → **auto-resume** + system message; scale-to-zero
  cold-wake; `maxSessions` behaviour; high-frequency event **storms** (event loop not starved);
  worker containment of a throwing/hanging emitter.
- **I. Cross-cutting** — edge cases (bad signature → 401, unknown path → 404, malformed → 0 events);
  performance (latency, tokens, throughput); multilingual; budget (runs use direct Azure keys so a
  tier cap can't halt a run).

## The harness (surviving references — READ these, do not re-derive)

Zero-dependency Node ESM in `sdk/org/scenarios/harness/`. Drives the pod's HTTP + WS API directly (no
browser). Read `sdk/org/scenarios/README.md`, `sdk/org/scenarios/_template/run.mjs`, and
`sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs` before writing Acts.

```js
import { getUser } from '../harness/provision.mjs';        // register → pod → Azure keys → ready+settled
import { Pod } from '../harness/lib/pod.mjs';               // projects, spaces, files, store, apps, hooks, inbound, uploads
import { ThingSession, approveAllConsent, denyAllConsent } from '../harness/lib/thing.mjs';
import { Report } from '../harness/lib/report.mjs';         // → Actual-results markdown + trace

const user  = await getUser('08-small-shop');            // { userId, token, pod }
const pod   = new Pod({ base: user.pod, token: user.token });
const thing = new ThingSession(pod, { projectId, onAsk: approveAllConsent, verbose: true });
await thing.start();
const turn  = await thing.send('do the thing');
const att   = await pod.upload('fixtures/notes.md');
const t2    = await thing.sendWithAttachments('use this', [att]);   // WS path (HTTP /message drops attachments)

turn.delegates        // ['system-appbuilder/automator/…']    — assert routing
turn.yields           // every global THING called (installSpace, emitEvent, writeProject*, …)
turn.errors           // eval/typecheck errors this turn (classify recovered vs fatal)
turn.tokens           // { in, out }
thing.consentCards()  // every ConsentCard raised + how it was answered
await pod.listSpaces(projectId)                              // real spaces on disk
await pod.appBuild(projectId)                                // { built, assetManifest, routes }
await pod.appData(projectId, 'flights')                      // real DB rows
await pod.inbound('demo', signedBody, { 'x-demo-signature': sig })  // deliver a signed webhook

const r = new Report('08-small-shop', 'title');
r.step('Act VI — …', 'expected'); r.check('label', pass, actual); r.metric('turn', s, 's');
r.save('sdk/org/scenarios/08-small-shop/results/report.md'); r.saveTrace('sdk/org/scenarios/08-small-shop/results/trace.json', thing);
```

**Runner hardening patterns — every new Act MUST keep these (each was learned from a real mid-run
failure):**
- **Checkpoint after every Act** to `results/checkpoint.json` (label, project, sessionId, acts
  passed) and support `--acts=6,7` to run a subset. A multi-hour run resumes from the last good Act.
- **Keepalive pinger** — a free-tier pod scales to zero on idle, killing the in-memory session:
  `setInterval(() => pod.req('POST','/api/keepalive',{}), 30_000)`.
- **Resilient `send`** — on `404 unknown session` OR `entered error state`, wait for the pod,
  re-resume the persisted session (or start fresh), retry. (This IS the restart→auto-resume edge.)
- **Scripted `onAsk`** — approve/deny consent per branch, and **settle any other ask (a Form) with
  `{}`** so an autonomous run never hangs.
- **Assert on the TRACE + real side effects, never prose.** Which agent it delegated to, which
  consent-marked global it called, which rows appeared, tokens burned. Gotchas: web research surfaces
  as `fetch` yields (count them, plus `webSearch`/`webFetch`); delegate-sub-session yields appear in
  the parent stream; tolerate curly apostrophes in refusal text (`can['’]t`); end with a re-add /
  re-ask to guard against routing degradation.
  - **Good:** `flights` has ≥5 rows matching the file; `didDelegate('system-appbuilder')`; a bad-HMAC
    inbound returns 401 and writes 0 rows. **Bad:** the reply "contains the word booked".

**Harness resilience already built in (do NOT re-solve):** session eviction (`404`→ soft
`sessionGone`, `#ensureAlive()` re-establishes before next send; raise `MAX_SESSIONS` with
`kubectl set env deployment/lmthing MAX_SESSIONS=25 -n user-<id>` for session-heavy Acts); cold-wake
504 retry; consent/asks answered by `onAsk`. **Gotchas:** gateway JWT secret is double-base64;
`PUT /api/compute/env` **rolls the pod** → load env before the first turn; `pod.ready` is true
throughout a rolling update → use `waitPodSettled`; consent needs an **interactive** session
(`POST /api/sessions`; headless fails closed); the `built` flag is `manifest.build.built` but the
authoritative check is `POST /app/build` + real assets in `assetManifest`.

## The run → triage → fix → verify → report loop

1. **Provision + smoke.** `cd sdk/org/scenarios/harness && node provision.mjs 08-small-shop`
   (disposable `user-<id>` + pod + Azure keys, budget-free), then `node smoke.mjs` to prove prod is
   healthy. Load integration/env secrets via `mergePodEnv` **before** the first session (a `PUT env`
   rolls the pod). Keep the conversation realistic — drift, incremental, unrelated chatter between
   load-bearing turns; a promise that only holds under a scripted happy path isn't kept.
2. **Run Act by Act, in the FOREGROUND.** You are a **headless `claude -p` session**: when you stop
   emitting tool calls your turn ENDS, your session dies, and every background process you spawned is
   orphaned and killed. So there is **no "wake me when it finishes"** here — do **NOT** launch the
   runner in the background and "wait", and do **NOT** rely on a watcher/heartbeat to re-invoke you
   (that pattern is for the interactive Claude Code harness, not for headless). Instead **run the
   runner as a single blocking foreground command with a long timeout** so your turn stays alive
   until it exits, e.g. `cd sdk/org/scenarios/harness && node sdk/org/scenarios/08-small-shop/run.mjs --acts=1` with the Bash
   `timeout` set to ~1500000 ms (25 min); when it returns, read its output, then run the next Act(s)
   the same way. Because the runner **checkpoints after every Act** to `results/checkpoint.json` and
   resumes with `--acts=`, a run that gets cut off is resumable next time — but within THIS turn,
   keep the foreground call blocking until each Act batch completes. Never say "waiting for the run
   to finish" and stop — that silently ends the whole session with the mission unfinished.
   (zsh: `status` is read-only — use another name.)
3. **Triage every failure BEFORE changing anything** — is it a harness bug or a product bug? Read the
   trace (`GET /api/sessions/:id/events`) for the exact `eval_error`/`typecheck_error` **statement**,
   and pod logs (`kubectl logs`) for boot/hook-load failures. **Reproduce minimally** — a direct
   one-turn probe on a fresh project isolates whether it's the phrasing, the agent, the runtime, or
   your assertion (a *vague* ask hallucinating vs the *same* ask phrased directly authoring cleanly
   is itself the finding).
4. **Fix in the product, surgically, with a test that would have caught it.** Most failures are
   **prompting** — an agent `instruct.md` under `sdk/org/libs/core/system-spaces/<space>/agents/
   <agent>/` (over/under-delegation, over-scaffolding, malformed authoring, missing capability
   grants); THING's `instruct.md` is shared — call out any change loudly. **Runtime** fixes flow: an
   authoring writer (`libs/cli/src/app/authoring/globals.ts`) → core injection
   (`libs/core/src/exec/app-globals.ts`) → per-grant DTS (`libs/core/src/typecheck/library-dts.ts`) →
   session-manager wiring → the agent's `capabilities:`; rebuild `@lmthing/core`
   (`pnpm --filter @lmthing/core build`) so the cli sees new types. **Validate authored source before
   it lands** — reject a file with literal `\n` escapes at the writer (`{ok:false}`) so the agent
   retries; never leave a broken file behind. **Recovered vs fatal:** a typecheck/eval error the loop
   retried and the deliverable still landed is the retry surface — hard-assert the **deliverable**,
   record recovered errors as a metric + note, never hide them, never fail the whole scenario on them.
   A **harness/assertion bug** → fix the assertion to be accurate and, where possible, **stronger**,
   never merely looser to force green.
5. **Verify the fix live.** A **prompt-only** fix to a materialized system space can be **hot-patched**
   onto the running pod without a rebuild: `PUT /api/projects/system/spaces/<spaceId>/files/<rel>`
   `{content}` (read back via `GET …/files`), then restart to reload. **Code** (core/cli) fixes need a
   new compute image: push the submodule → bump the parent pointer → CI builds
   `compute:<7-char-parent-sha>` → upgrade the test pod:
   `kubectl set image deployment/lmthing compute=lmthingacr.azurecr.io/compute:<7-char-sha> -n user-<id>`
   then `kubectl rollout status … --timeout=180s`, and re-run the failing Act. Watch: 8-char tag →
   `ImagePullBackOff`; check the `build (compute …)` job directly (the post-build git jobs often fail
   on a rebase race without the image failing); pods have **no readinessProbe** by design (hence the
   keepalive); tolerate one early 503 after a wake; ArgoCD selfHeal can revert a manual image set on
   `user-*` — re-set if needed.
6. **Submodule-first commit discipline (many agents share ONE `sdk/org` working tree).** Stage only
   YOUR files (`git add <paths>`); stash others' scenario-result edits before `git pull --rebase`;
   retry on conflict; never force-push. Commit + push the **submodule** first, then the **parent**
   (`git add sdk/org` + rebase + push) — pushing the parent is what triggers CI to build
   `compute:<7-char-parent-sha>`.
7. **Verify the deploy actually landed** (not just the push): confirm the `build (compute …)` CI job
   went green and the tag exists in ACR, upgrade the test pod to that image (§5), roll it, and re-run
   the affected Act live so the fix is proven **in production**. If CI/ArgoCD is flaky, retry
   (`gh run rerun --failed`, ArgoCD hard refresh) rather than declaring success on an unverified
   deploy. A run whose fix has NOT been verified live is not done — record the deploy status
   honestly.

## PROGRESS protocol (MANDATORY, every step)

Maintain the per-run progress log at **/home/vasilis/LMTHING/lmthing/automation/instances/scenario-campaign/rounds/1/08-small-shop/PROGRESS.md**.
- At **every step**, append to "Steps" what you did (provisioned, drafted Act VI, ran it, triaged,
  fixed, verified).
- Append to "Files added to context" **the exact new files you read / added to your context** that
  step (path + one-line why) — traces, instruct.md files, harness libs, the scenario.md.

## Commit protocol (MANDATORY)

- **Commit as early as possible and commit often** — small commits as you progress, all to the branch
  this run started on: **`main`**. Do **not** create or switch branches.
- Submodule first, then the parent pointer (§6). Never leave `main` broken on either repo.
- End every commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Definition of done for this run

- `sdk/org/scenarios/08-small-shop/scenario.md` has all six sections + the feature checklist + the Acts table, now **including the
  new Acts** you added this round.
- `sdk/org/scenarios/08-small-shop/run.mjs` reproduces the literal user flow and its Acts match the `.md` table **1:1**, keeping
  the hardening patterns and the existing Acts (no regression).
- Every assertion reads the trace or real state (no prose grading).
- It **ran e2e live against prod** and reached a verdict; **every product bug found is fixed with a
  test** and its fix verified live (fix sha recorded).
- `sdk/org/scenarios/08-small-shop/results/` has the report + trace; the `.md` **Actual results** section is filled with:
  verdict (`PASS` / `CONDITIONAL PASS` / `FAIL`), the per-Act table, every issue + fix sha, the
  performance table, and the **honest narrative of where the product broke down**.
- Both repos committed + pushed on `main` (submodule first, then parent pointer).


Begin now: orient (read the scenario + its results + the harness), then work goals 1 then 2.
