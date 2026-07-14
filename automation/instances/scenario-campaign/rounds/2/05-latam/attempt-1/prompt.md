# Scenario campaign — `05-latam` · round 2 (ADD ACTS (batch 2))

`05-latam` already has a runner and has been extended in earlier rounds. This round: **add
ANOTHER batch of additional Acts and continue from there.** Never regress the existing Acts —
extension is strictly additive.

1. **Orient & resume.** Read `sdk/org/scenarios/05-latam/scenario.md` (esp. its Acts table + Actual-results), `sdk/org/scenarios/05-latam/run.mjs`,
   and `sdk/org/scenarios/05-latam/results/` (report, trace, checkpoint) to see exactly which Acts exist, which passed,
   and any open frontier a prior round recorded. Read this run's `/home/vasilis/LMTHING/lmthing/automation/instances/scenario-campaign/rounds/2/05-latam/PROGRESS.md` if it exists.
2. **Pick the next batch of Acts (2–4)** from the feature catalog below — capabilities
   `05-latam` still does **not** cover — extending the same persona / same growing project
   realistically (incremental drift, unrelated chatter between load-bearing turns, a re-add/re-ask at
   the end to guard against routing degradation).
3. **Add them to `sdk/org/scenarios/05-latam/scenario.md` (Acts table + user stories/expectations) AND `sdk/org/scenarios/05-latam/run.mjs` (1:1)**,
   keeping every hardening pattern and all prior Acts. Provision, then run the **FULL** scenario live
   (resume from the last good Act via the checkpoint; use `--acts=` to re-run just the new ones while
   iterating, but do a full green pass before reporting).
4. **Triage → fix in the product with a test → verify live → report** exactly as below. Update the
   scenario's **Actual results** with the new verdict, per-Act table, every issue + fix sha, the perf
   table, and the honest narrative. Commit + push both repos (submodule first, then the parent
   pointer) and confirm the deploy.

Everything about how — the artifact format, the feature catalog, the harness API and hardening
patterns, the run/triage/fix/verify/report loop, and commit discipline — is below.

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

- **Scenario:** `05-latam` (`sdk/org/scenarios/05-latam`)  ·  **Round:** 2 — ADD ACTS (batch 2)  ·  **Branch:** `main`

**Working directory:** you start at the **lmthing monorepo root** and have the **whole monorepo** in
scope — both the parent repo and the `sdk/org` submodule. You will commit + push **both** (submodule
first, then the parent pointer) to trigger CI, and you must **verify the deploy actually lands**
(image built, pod upgraded, feature live), not merely that the push succeeded. Scenario files live at
`sdk/org/scenarios/05-latam`; the harness at `sdk/org/scenarios/harness/`.

## The mission

Extend `05-latam` with **additional Acts**, run the **whole scenario end-to-end against LIVE
production**, triage every failure, **fix real product bugs in the product (with a test)**, verify
the fix live, and **report honestly**. A scenario is not a feature test — it is a **promise,
exercised end-to-end through the THING agent against live prod, and asserted on real system state**
(the execution trace of what the agent did, and the actual spaces / app / database rows it
produced). The most valuable output is the **honest narrative of where the product broke down**, not
a green checkmark. A scenario that only grades the model's prose passes when the system is broken —
never assert on prose.

## Fan-out (subagents)

1. **catalog-scout** — READ-ONLY prep: read sdk/org/scenarios/05-latam/scenario.md + sdk/org/scenarios/05-latam/run.mjs + sdk/org/scenarios/05-latam/results and the feature catalog in this prompt; list which catalog capabilities 05-latam does NOT yet cover, and propose the next 2–4 Acts (name + what each asserts on the trace/real state). Do NOT provision, open a THING session, or send any turn — analysis only.

## The user is a REAL PERSON, not a product manager (hard rules)

Every scenario was rewritten around these. They are the difference between testing the product and
testing a script. Hold them in `sdk/org/scenarios/05-latam/scenario.md` and in every message `sdk/org/scenarios/05-latam/run.mjs` sends.

1. **The user knows NO lmthing terminology. Ever.** In a verbatim user message they never say — and
   never imply they know about — *space · project · app (as a product noun) · agent · hook · cron ·
   emitter · event · webhook · integration · install · database · table · schema · row · column · API ·
   endpoint · build · deploy · function · capability · consent · delegate · THING*. They talk about
   their life: *"I keep losing track of this stuff"*, *"just tell me before I run out"*, *"can you put it
   somewhere I can actually look at it?"*. If a message would only be written by someone who has read
   our docs, **it is wrong** — rewrite it.
2. **THING PROPOSES the app. The user never asks for one.** The user dumps their files and describes a
   problem; THING must recognise it deserves a real, openable thing and **offer** it. The user's consent
   is a plain *"yes please"*, not a specification. Assert the **offer appeared before any authoring
   yield**, and that a bare "yes" was enough.
3. **Research and space creation are AUTOMATIC and invisible.** The user never asks for specialists or
   research. THING decides it needs to know things, researches them live (`webSearch`/`webFetch` yields
   in the trace), **creates the per-topic spaces itself**, and registers them. Assert the spaces exist on
   disk and a later plain question is answered from inside the right one — while the user never named one.
4. **Every fixture is proved by its unique token, in REAL STATE.** `fixtures/links.md` gives each
   fixture a token that appears in that file and nowhere else. For every fixture, an Act must assert its
   token landed in a **db row or a space file** — never in prose. Prose can be guessed; a row cannot.
   That is the only proof the image went through vision, the audio through transcription, the PDF/xlsx
   through `readDocument`.

**Performance targets are hang detectors, not SLOs.** Record the actual time as a metric on every Act;
only FAIL on the ceiling — that means something is *broken*, not merely slow. (Measured on live prod:
one authoring turn ran **8 minutes**; a cold-wake blew a 60 s budget; a full run takes hours.)

## The scenario artifact (what you are editing)

> **`run.mjs` has been DELETED for every scenario.** `scenario.md` is now the spec and it has been
> rewritten from scratch. On a scenario's round 1 your job is to **implement `run.mjs` from its
> `scenario.md`** (start from `../_template/run.mjs`), Act by Act, and get it to a green baseline —
> not to invent a new story. On later rounds you extend it.

A scenario is TWO files plus generated results, all under `sdk/org/scenarios/05-latam`:

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

## Fixtures — REAL files, found on the REAL web (every round)

A scenario is only as honest as its inputs. A hand-invented fixture (`Item A — €10`) is a fixture the
agent can *guess*: the Act goes green whether or not the file was ever actually read. **Real files —
messy, oddly formatted, in a real person's words — are what catch the bugs.**

**Every round, add at least one NEW fixture of a kind this scenario does not have yet**, sourced from
the real web, and evolve the scenario to use it. Across rounds, work toward all five kinds:

- **Images** — real photos/scans (Wikimedia Commons and the like). Exercise the vision path.
- **PDFs** — a real invoice / quote / policy / spec sheet / leaflet, not a generated one.
- **Spreadsheets** — a real multi-sheet `.xlsx` (build it from real open data; keep real formatting,
  merged headers, a stray empty row — the mess is the point).
- **Voice memos** — **generate with Azure TTS**: the `tts` deployment on `$AZURE_RESOURCE_NAME` using
  `$AZURE_API_KEY` (both in `sdk/org/.env`) —
  `POST https://<resource>.openai.azure.com/openai/deployments/tts/audio/speech?api-version=2024-05-01-preview`
  with `{model:"tts", input:"<what the persona says out loud>", voice:"alloy"}`. Write a realistic
  spoken monologue (hesitations, corrections — not a clean spec). **Verify the round-trip** by
  transcribing the result through the whisper deployment before you rely on it. Do at least one in the
  persona's own language (e.g. Greek) — it tests transcription + multilingual routing at once.
- **Website links** — real, currently-HTTP-200 URLs, in `fixtures/links.md`, that the research Acts
  actually fetch.

Rules (each exists because it was violated once):
- **Every fixture must carry at least one fact/token that appears in NO other fixture**, and an Act
  must assert **that fact landed in real state** (a db row, a space file) — never in prose. That is the
  only proof the file was *read* rather than *guessed*. **Check the token is disjoint** (grep across
  `fixtures/`) before you rely on it; a token that also appears in the spreadsheet makes the audio
  assertion worthless.
- Fixtures are **committed and self-contained** under `sdk/org/scenarios/05-latam/fixtures/`. Record where each
  came from (source URL) in `fixtures/links.md`.
- **Wire it into BOTH** `scenario.md` (the user flow + the Acts table) and `sdk/org/scenarios/05-latam/run.mjs` (uploaded,
  asserted). A fixture nobody uploads is dead weight — delete it or use it.
- Never overwrite an existing fixture you did not create; add alongside it.

## Feature catalog — draw every NEW Act from here

Pick additional Acts that exercise catalog capabilities `05-latam` does **not** yet cover.
Prefer a coherent slice end-to-end over an isolated call. **Read the coverage audit below first** —
the point of a new round is to reach a capability no scenario has ever touched, not to re-run a
capability all four already assert.

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
  serving at `/app/<id>/`; the app data API (`/api/projects/<id>/app/data/<table>`); the app's **own**
  API routes (`/<project>/api/<route>` — the ones its pages actually fetch); the **always-available
  in-app chat agent** and **self-evolution from inside the app** (§A1); the app **rendering correctly
  in a real browser** (§A2). See **The app contract** — A1 and A2 are mandatory, not optional Acts.
- **G. Attachments** (`system-files`/`system-vision`) — upload (`POST /api/uploads`); deliver WITH a
  message (WS path); `readDocument` (text/markdown/pdf); hand an attachment to a specialist via
  `attachmentIds`; vision for images, transcription for audio.
- **H. Pod lifecycle & resilience** — restart → **auto-resume** + system message; scale-to-zero
  cold-wake; `maxSessions` behaviour; high-frequency event **storms** (event loop not starved);
  worker containment of a throwing/hanging emitter.
- **I. Cross-cutting** — edge cases (bad signature → 401, unknown path → 404, malformed → 0 events);
  performance (latency, tokens, throughput); multilingual; budget (runs use direct Azure keys so a
  tier cap can't halt a run).

## Coverage audit — WHAT NO SCENARIO HAS EVER TESTED (draw new Acts from HERE first)

Audited 2026-07-13 across all six scenarios (05, 06, 07, 08, 09, 10) — the whole documented surface in
`org/docs/` vs what the runners actually assert.

**Already well covered — do NOT spend a new Act re-proving these:** multi-attachment ingest (file/
image/audio) and fact-grounding into real rows · per-topic space growth + no-clobber + routing into a
built space · research → a new db row + anti-hallucination · app build + served 200 + real rows ·
growth-must-not-delete · all four emitter kinds authored + forced-run · db-emitter → agent alert that
sends nothing · cron → derived rows · `installSpace` consent approved AND denied · signed inbound
(401 on bad sig, 404 unknown path, 0-cost non-matching) · restraint/refusal · multilingual (es/el/nl) ·
memory recall · restart → auto-resume · event storm · engineer → persisted project function · the
in-app chat dock.

**Never exercised — pick 2–4 that fit `05-latam`'s persona and build them into the story.** A
capability nobody has run is where the bugs are; that is the whole point of this campaign.

- **J. Conversation & UI surface** — a space's own `components/view/<Name>.tsx` rendered by `display()`
  and `components/form/<Name>.tsx` rendered by `ask()` (opt-in per agent); `inspect()` and its
  operators (`path`/`keys`/`count`/`search`/`filter`/`slice`/`sample`) on a large value; a
  **cancelled/dismissed `ask()` resolving `null`** (the agent must cope, not hang); the `ask()`
  security guards (a `script`/`iframe` descriptor, `dangerouslySetInnerHTML`, a `javascript:` URL are
  all rejected — a *negative* test).
- **K. Orchestration** — `fork()` used directly (isolated context, required output schema; `role:
  'explore'|'plan'` is **read-only** — the write globals are absent from its DTS; the
  `maxConcurrentForks` queue; a never-resolving fork → nudge → schema-valid salvage; an explicit
  `timeout` rejecting instead). `tasklist()` **degraded** mode (`{ok:false, degraded:true, reason}`)
  and its DAG features: `dependsOn`, `forEach` fan-out, the `condition` DSL, `optional` skip,
  `prelude`. **Code nodes** in a space tasklist (`NN-<id>.ts`, `node` metadata, worker-isolated).
  `canDelegateTo` tri-state (`[]` = none, `["*"]` = all, an allowlist) and the **denial message naming
  the allowed targets**. The delegation depth cap (`maxDepth=5`). `registerSpace()` + `registered:*`.
- **L. Data & the typed surface** — `db.query`'s `include` (a declared `belongsTo`/`hasMany` relation
  expanded inline — so the app needs a real relation); **`db.createTable`/`db.addColumn`** (LIVE schema
  migration, which is NOT the same thing as writing a schema file); **`apiCall(name, input)`** — the
  agent calling the project's OWN api endpoint (allowlist-gated, typed overloads).
  **Capability gating AT TYPECHECK:** an agent without a grant must fail **typecheck** (the global is
  absent from its DTS) rather than throw at runtime — assert the `typecheck_error`, this is the
  security model's load-bearing claim. Also `typecheckSource()`, `progress()`, `sleep()`,
  `setSessionMeta({title,slug})`.
- **M. Knowledge & long conversations** — `loadKnowledge`: a real knowledge tree (domain/field/option)
  authored by the architect, 2-part **on-demand** vs 3-part **preloaded**; `readDocument` on an **image
  failing on purpose** (it must delegate to vision instead); **history summarization** past
  `maxHistoryTurns` (a genuinely LONG conversation — last 6 turns verbatim + a summary — does the
  agent still know the household rule from turn 3?); `defaultAction` frontmatter fast path.
- **N. Store, consent, integrations** — `storeSearch`/`storeInspect` **browsing before installing**;
  the **`@consent` pragma on a space FUNCTION** (not just `installSpace`); consent **failing closed**
  in a headless context (a fork/delegate/hook must never auto-approve); the pristine-vs-diverged hash
  guard on re-install (`force:true`); `integrationStatus(spaceId)` + `GET /api/projects/:id/
  integrations` reporting `missingRequired` **names, never values**; `callConnection`'s **SSRF guard**
  (an internal host / DNS-rebind target must be refused — a negative test).
- **O. The served app** — `<Chat agent="<space>/<agent>">` (a SPACE agent embedded in a page, not just
  THING); the project's own `components/<Name>.tsx` + `_app`/`_layout` wrappers; `@app/types`
  generated row/endpoint types actually used by a page; an API handler that **throws** (worker crash
  boundary holds, pod survives; `HttpError` shape); schema reconcile — additive OK vs **non-additive
  (drop/rename/PK move) failing loud**; the app admin surface (data browser, path-scoped file editor,
  build status); the clean root URL and the CSP on served pages.
- **P. Platform & resilience** — the **loop guard** (coalescing, depth cap, self-write/self-trigger
  exclusion, cooldown) — an event hook that writes the table it listens to must NOT loop forever.
  **Payload validation** (undeclared/mistyped event fields dropped). The `webSearch` **provider-chain
  fallback** (Tavily → Bing → DDG) and `webFetch` render modes. Upload limits (the 25MB cap) and
  server-side attachment-id re-resolution. `GET /api/session-ledger` (token/cost incl. the **delegate
  tree**). Backup/restore. `PUT /api/env` (live) vs `/api/compute/env` (rolls the pod).

**One inconsistency to settle:** "zero unrecovered eval/typecheck errors across the whole session" is a
**hard check** in some scenarios and a soft metric in others. Make it a hard check in
`05-latam` — recovered errors stay a metric, unrecovered ones fail the run.

## The harness (surviving references — READ these, do not re-derive)

Zero-dependency Node ESM in `sdk/org/scenarios/harness/`. Drives the pod's HTTP + WS API directly (no
browser). Read `sdk/org/scenarios/README.md`, `sdk/org/scenarios/_template/run.mjs`, and
`sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs` before writing Acts.

```js
import { getUser } from '../harness/provision.mjs';        // register → pod → Azure keys → ready+settled
import { Pod } from '../harness/lib/pod.mjs';               // projects, spaces, files, store, apps, hooks, inbound, uploads
import { ThingSession, approveAllConsent, denyAllConsent } from '../harness/lib/thing.mjs';
import { Report } from '../harness/lib/report.mjs';         // → Actual-results markdown + trace

const user  = await getUser('05-latam');            // { userId, token, pod }
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

const r = new Report('05-latam', 'title');
r.step('Act VI — …', 'expected'); r.check('label', pass, actual); r.metric('turn', s, 's');
r.save('sdk/org/scenarios/05-latam/results/report.md'); r.saveTrace('sdk/org/scenarios/05-latam/results/trace.json', thing);
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

## The app contract (MANDATORY for every scenario that builds an app)

An app that returns 200 and has rows in its tables is **not** a working app. Both rules below are
hard requirements of every scenario that builds one — spec them in `scenario.md`, assert them in
`sdk/org/scenarios/05-latam/run.mjs`, and if the product cannot do them yet, **implement the missing feature** (§4 fix loop:
writer → core injection → DTS → capability → test → deploy → verify live). Never skip the
requirement, never fake it, never weaken the assertion to go green.

### A1. Every app ships an ALWAYS-AVAILABLE in-app chat agent

The app is a **living surface**, not a static dashboard. Every app you build MUST embed a chat agent
that is:
- **Always available from every page** of the served app (a persistent panel/widget — not a link that
  bounces the user back to `/chat`).
- Backed by a **real THING session scoped to that project**, with full authoring capability — the
  same agent, the same conversation.
- Able to carry the **whole conversation AND the self-evolution from inside the app**: from that chat
  the user can ask for a new table, a new page, a new section, a new space, a new integration, or a
  data change — and it must **land live** in the running app (new schema bound, page served, space
  registered), with no rebuild-by-hand and no leaving the app.

**If the runtime cannot do this today, that is the gap the scenario exists to close — build it.**
Add whatever is missing (an embeddable chat component wired to a project-scoped session, the route
that serves it, the capability grants that let an in-app turn author, the live-rebind after an
in-app `writeProject*`), with a test that would have caught its absence, then deploy and verify live.

**Assert it on real state:** an Act must send a message **through the in-app chat** (drive it in the
browser, §A2) and prove a **real change landed** — a new row / new page / new table / new space that
was not there before — never that the reply "said it would".

### A2. Browser verification — the app must RENDER, not just return 200

You have the **chrome-devtools MCP** available in this session (already configured — a real Chrome).
**Use it.** A scenario that only calls the data API is blind to the way apps actually break.

Recipe (learned the hard way):
- Mint the disposable user's session, then inject it on **BOTH origins** — the pod SPA
  (`https://lmthing.chat`) **and** the served-app origin (`https://lmthing.app`, where
  `/app/<project>/` redirects). The **served app authenticates by the `access_token` COOKIE**, not
  just `localStorage.lmthing_session` — set both, or the app renders `Jwt is missing`.
- Load the served app, wait out the cold-wake/rollout banners, then assert on the **rendered DOM**:
  the real data is on screen (**non-zero counts, actual row values from the fixtures**), the in-app
  chat (A1) is present and usable, and the page has **no console errors and no failed fetches**.
- **Also assert the app's OWN API routes** (`GET /<project>/api/<route>`) return 200 with the right
  shape — not just `/api/projects/<id>/app/data/<table>`.
  > **This is not hypothetical.** A shipped scenario went green while its dashboard rendered
  > `0` / `€0.00` for every tile: the raw `app/data/<table>` API returned all its rows, but the page's
  > own aggregation route (`/api/stock-dashboard`) threw a **500**, so the UI silently fell back to
  > zeros. The runner only checked the raw data API, so it never saw it. **Assert the layer the user
  > actually sees.**
- Put the evidence in the report: what you saw rendered (and a screenshot path), plus any console/
  network errors. "An app that opens but is empty" is an **anti-expectation** — a FAIL, not a pass.

## Make the SYSTEM SPACES smarter (mandatory, every round)

Most of what a scenario exposes is not a broken function — it is an agent **judging badly**. It
over-scaffolds a heavyweight app on a vague hello. It answers instead of building. It says "noted!"
and saves nothing. It waits to be told what a specialist is instead of researching and creating one.
It claims it saved a cheaper option it never verified. **None of that is a code bug. It is a prompt
bug**, and the fix belongs in the agent's own instructions — where it makes the product smarter for
every user, not just for this scenario.

The brains live in the repo, and you may edit them:

```
sdk/org/libs/core/system-spaces/<space>/
  agents/<agent>/instruct.md     # the agent's judgment: when to act, when to delegate, when to refuse
  agents/<agent>/charter.md      # fork-safe identity — injected into EVERY fork of it
  knowledge/<domain>/<field>/    # durable know-how it can loadKnowledge() on demand
  tasklists/                     # the DAGs it runs
```
`user-thing/agents/thing/instruct.md` is **THING's triage brain** and is shared by every scenario —
changing it is powerful and dangerous. Call out any change to it loudly in the report.

**Every round must land at least one improvement to a system-space prompt** (or its knowledge/
tasklists) that makes an agent measurably smarter, with the before/after evidence in the report:
what it used to do, what it does now, and the trace that proves it.

### The one rule that keeps this honest: generalize, never overfit

The improvement must be a **principle a competent colleague would agree with, stated in the abstract**
— not a hint about this scenario.

- ✅ *"When the user hands you material and describes a recurring frustration, OFFER to build them
  something they can open and use. Do not wait to be asked — they do not know it is an option."*
- ✅ *"Before you claim you saved something, re-read what you actually wrote. Never report a result you
  did not verify."*
- ✅ *"If you need domain facts you do not have, research them and keep them — do not ask the user to
  supply what you could look up."*
- ❌ *"If the user mentions ceramics, create a stock-tracking table with a reorder threshold."* ← This
  is **cheating**. It teaches THING the answer to one exam question and makes it dumber everywhere
  else. Any scenario-specific string in a system-space prompt (a persona's name, a fixture's contents,
  a table name from this scenario) is an automatic **FAIL of this round** — remove it.

**This holds for EXAMPLES too — positive AND negative — not just instructions.** Every table name,
column, id, price, booking ref, or persona you write into a system-space prompt to *illustrate* a
point must be a **generic placeholder** (`service_log` / `services`, `orders`, `<the value from the
file>`), never a literal from any scenario (`boiler_service_log`, `household_items`, `A3932`,
`ZZJQUU`, `Elena`). Two reasons this is not pedantry: (1) an example in an agent's brain gets **copied
into real output** — this already happened, hardcoded `flights`/`ATH→CAI`/ref `ZZJQUU` examples were
landing verbatim in real users' data; a "don't do this" example is one careless read from becoming a
"do this" template. (2) A concrete scenario name in even a *negative* example is still leaking the exam
into the answer key. Grep your own prompt diff for scenario literals before you commit it.

If you find yourself writing the scenario's specifics into an agent's brain to get a green, **stop**:
the green would be a lie. Report the failure honestly instead — an honest FAIL is worth more than a
fake PASS, and it is the whole point of this campaign.

### Verify a prompt change like any other change

A prompt-only fix can be **hot-patched onto the running pod** without a rebuild — `PUT /api/projects/
system/spaces/<spaceId>/files/<rel>` `{content}`, then restart to reload — so you can prove it live in
minutes. Then commit it to source, and confirm the same behaviour after the image rolls. And because
`instruct.md` is shared, a change there must not regress the others: re-run the Act that motivated it
**and** one Act that depends on the behaviour you touched.

## The run → triage → fix → verify → report loop

1. **Provision + smoke.** `cd sdk/org/scenarios/harness && node provision.mjs 05-latam`
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
   until it exits, e.g. `cd sdk/org/scenarios/harness && node sdk/org/scenarios/05-latam/run.mjs --acts=1` with the Bash
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
   **prompting** — the agent judged badly, so fix its brain: see **"Make the system spaces smarter"**
   above (generalize, never overfit; a scenario-specific string in a system-space prompt fails the
   round). **Runtime** fixes flow: an
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

Maintain the per-run progress log at **/home/vasilis/LMTHING/lmthing/automation/instances/scenario-campaign/rounds/2/05-latam/PROGRESS.md**.
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

- `sdk/org/scenarios/05-latam/scenario.md` has all six sections + the feature checklist + the Acts table. **Round 1: do not
  rewrite the story** — it was authored deliberately; implement it. Later rounds: add the new Acts.
- `sdk/org/scenarios/05-latam/run.mjs` **exists and implements `scenario.md` Act for Act (1:1)** — on round 1 you are writing
  it from scratch (from `../_template/run.mjs`); later rounds keep every existing Act (no regression)
  and the hardening patterns.
- **The four hard rules hold** in every message the runner sends: no product jargon from the user ·
  THING proposed the app (asserted) · spaces came from THING's own research (asserted, never asked for)
  · every fixture's unique token asserted in real state.
- Every assertion reads the trace or real state (no prose grading).
- **New Acts come from the coverage audit (J–P)** — capabilities no scenario has exercised — and the
  report names which gap each one closed. Re-proving an already-covered capability does not count.
- **From round 2 on: at least one NEW real fixture** sourced from the real web (or Azure-TTS-generated
  for audio), committed under `fixtures/`, uploaded by `sdk/org/scenarios/05-latam/run.mjs`, and asserted via a token that
  appears in **no other fixture** landing in **real state**. Its provenance is recorded in `links.md`.
- **Unrecovered eval/typecheck errors across the session = 0**, as a hard check (recovered ones stay a
  metric).
- **At least one system-space prompt got smarter** (an `instruct.md` / `charter.md` / `knowledge/` /
  tasklist under `sdk/org/libs/core/system-spaces/`), stated as a **general principle** — with the
  before/after behaviour and the trace that proves it, in the report. **Zero scenario-specific strings**
  went into any agent's brain (a persona's name, a fixture's contents, this scenario's table names) —
  that is overfitting, and it fails the round.
- **The app contract holds (if this scenario builds an app):**
  - **A1** — the app has an **always-available in-app chat agent**, and an Act proves a real change
    (row / page / table / space) landed **from inside the app**. Any feature this required was
    implemented in the product, tested, deployed, and verified live.
  - **A2** — the app was **opened in the chrome-devtools browser** and **renders the real data**
    (non-zero, actual fixture values), with the in-app chat present, **no console errors, no failed
    fetches**, and the app's **own API routes** asserted 200 + correct shape. Evidence (what rendered
    + screenshot path) is in the report. An app that opens empty is a **FAIL**.
- It **ran e2e live against prod** and reached a verdict; **every product bug found is fixed with a
  test** and its fix verified live (fix sha recorded).
- `sdk/org/scenarios/05-latam/results/` has the report + trace; the `.md` **Actual results** section is filled with:
  verdict (`PASS` / `CONDITIONAL PASS` / `FAIL`), the per-Act table, every issue + fix sha, the
  performance table, and the **honest narrative of where the product broke down**.
- Both repos committed + pushed on `main` (submodule first, then parent pointer).


Begin now: orient (scenario + results + runner), then add and run the next batch of Acts.
