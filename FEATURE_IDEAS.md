# Feature brainstorm — 45+ ideas from five lenses, grounded in the codebase

*Companion to `CODEBASE_REVIEW.md`, same branch. Produced by five parallel brainstorming passes
(end-user, builder/studio, integrations/automation, teams/sharing/monetization, runtime-architecture),
each grounded by reading the relevant code first. Every idea names the existing machinery that makes
it feasible. Sizes: S = days, M = weeks, L = a quarter-scale effort.*

---

## The five cross-cutting themes

1. **The delivery gap.** The proactivity loop is ~90% built and 0% delivered: `cronWakeTick()`
   genuinely wakes scale-to-zero pods on schedule, hooks fire, agents run — but there is no
   `notify()` global, no push anywhere, and hook output lands in a session ledger no UI opens.
   Every store-template hook (`trips/hooks/watch-booking-prices.ts`, `kitchen/hooks/weekly-wrap.ts`)
   is written as if someone will see the result; nobody does.
2. **Loops between users are one seam away.** `StoreResolver.republish?()` is declared but
   unimplemented; `/publish` is a 13-line stub; the team-invite rails (id-as-capability rows,
   single-use, claimable pre-account) are exactly the shape space-sharing needs; the team channel
   machinery is the `social/` SPA's entire pitch, already running privately.
3. **The trace is a product nobody renders.** Every model output, statement, yield (args *and*
   resolved value) is already recorded; `trace-tree.ts` reassembles it; the mock provider sits
   upstream of the tracer. Deterministic replay, counterfactual re-runs, agent contract tests, and a
   per-node "what could this agent see and what did it cost" report are all data-layer-complete.
4. **Code-as-interface enables safety UX tool-callers can't have.** One injection site
   (`createChildVM`), mutators funneled through enumerable seams, typecheck failures that name the
   exact missing capability — this unlocks whole-program preview-before-commit, just-in-time
   capability grants via consent card, and mechanically-provable least-privilege.
5. **The last mile of automation is authoring, not infrastructure.** The event pipeline (webhook/
   cron/db/internal emitters, hooks, threadKey sessions, the inbound broker) is complete; what's
   missing is the flow that goes from "when X happens, do Z" in chat to an installed, running,
   inspectable automation.

---

## Top 10 across all lenses

| # | Idea | Lens | Size | Why it wins |
|---|---|---|---|---|
| 1 | **Reachback** — `notify()` global + Inbox surface + push | End-user | L | Converts "a chatbot I open" into "an assistant that works for me"; every existing scheduled hook is already written against this missing channel |
| 2 | **Automation Weaver** — "describe the rule, get the wiring" | Integrations | L | Finder fit-check → consent install → architect authors the emitter def + hook (`writeEventFile`/`writeHookFile` exist) → republish arms it. The last mile that makes the event pipeline a product |
| 3 | **JIT capability elevation** — typecheck error → consent card → grant → retry succeeds | Runtime | M | Fixes a documented infinite-loop failure mode; highest value/effort on the runtime list; a demo no tool-calling product can give |
| 4 | **Publish-from-pod** — make `/publish` real | Monetization | L | The keystone: paid listings and workspace templates are blocked on it; `republish?()` and `.installed.json`'s `sourceHash` show it was anticipated |
| 5 | **Life Map onboarding** — first session interviews you and builds two real apps | End-user | M | The only non-imitable onboarding demo; 21 hand-written life-domain playbooks already exist as the taxonomy; `add_area` tasklist is the build path |
| 6 | **Preview Mode** — run the whole program against shadow resolvers, approve the typed diff once | Runtime | M/L | The most differentiated safety UX available on this architecture; per-call approval is both worse and harder |
| 7 | **Replay** — deterministic re-run + counterfactual branching of any trace | Runtime | M | Zero-spend debugging; keystone for contract tests, capability right-sizing, and self-repairing agents |
| 8 | **GitHub/Google event sources + Personal Endpoint** | Integrations | S/M | Highest capability-per-line in the repo: the GitHub verifier is registered and unused; a generic named-inbound-URL space unlocks the Shortcuts/Zapier/IoT long tail |
| 9 | **Send-a-space** — peer sharing on the invite rails | Monetization | S/M | Cheapest viral loop; invite rows + install engine + the already-consent-marked `installSpace` compose with almost no new concepts |
| 10 | **Trace Replay Debugger in Studio** | Builder | M | The server half is shipped (persisted sessions + meta endpoint); the UI hardcodes "Conversations (0)" and throws it away |

---

## Full catalog by lens

### A. End-user experience

| Idea | Pitch | Builds on | Size |
|---|---|---|---|
| ★ Reachback | `notify()` global + Inbox surface (5th SPA surface) + push; agent reaches you when the tab is closed | fire-and-forget global shape of `set-activity.ts`; telegram/whatsapp/sms send functions for fan-out; `GET /api/session-ledger`; mobile push is budgeted divergence in `apps/mobile`. Must respect tier `CronPolicy.minIntervalMs` | L |
| ★ Life Map | First-run interview ends with two working apps for *your* life areas | 21 domain playbooks in `user-thing/knowledge/organizing/split/`; `add_area` tasklist per area; `ask()` + Select/ButtonGroup; `LiveActivity.tsx` shows parallel specialist synthesis | M |
| ★ Live app cards | THING replies with an interactive, editable slice of your own app inline in chat | Descriptors already cross the sandbox; `Message.tsx#AskForm` has a space-component dispatch branch on `window.__SPACE_COMPONENTS__` — populated only by the CLI `--web` entry, so space-authored `ask()` forms **silently degrade to text inputs in production chat today** (latent bug; wiring it is the load-bearing fix) | M |
| Memory viewer | Browse/edit/trace what THING remembers, with provenance and one-tap forget | `user-memory` 4-tool agent; `write_fact` already classifies fact placement; settings tab or generated app | M |
| Drop Zone | Per-user inbound address + mobile share-sheet: send anything, get it filed and an app grown | `organize_material` tasklist *is* the pipeline (takes `attachmentIds`); `/api/uploads`; system-files + system-vision; broker URL already shown in Integrations tab | M |
| Standing grants | "Spend up to $2/day watching flights without asking" — consent with scope, budget, expiry | Consent is per-invocation today and `ask` is capability-false in forks/delegates — an autonomous hook can never ask; standing grants are the missing middle. Home: the Hooks tab | S/M |
| Open Loops | Visible list of what THING is waiting on, each backed by a real self-scheduled check | trips hooks prove the pattern; THING has `project:manage`; `POST /api/compute/cron-manifest` exists; `write_fact` already distinguishes passive fact vs active reminder | M |
| Voice capture (mobile) | Hold-to-talk one-liner routes itself to the right store | Web voice path is end-to-end (MediaRecorder → uploads → server-side transcript); `write_fact` routes; a capture screen is far smaller than porting ChatShell | M |
| THING in your messenger | DM the assistant in Telegram/WhatsApp/SMS with thread-persistent sessions | 9 messenger spaces ship; `runHeadlessThreaded` keyed by (channel, thread) exists ("the thread, not the person, owns the session"); design work = ask/consent in plain text | M |
| Undo | Plain-language ledger of what changed, one-click revert | `retract_fact`/`reconcile_conflict` half-design the semantics; `WriteListener` fires on every mutation (needs a before-image for update/remove); backups are deterministic `.sql` dumps | M |

### B. Builders & the studio

| Idea | Pitch | Builds on | Size |
|---|---|---|---|
| ★ Space Test Bench | `tests/` in the space format: machine-checkable expectations for agents, runnable in Studio and CI | Only correctness gate today is app-shaped (`13a-check_acceptance`); `scenarios/lib/{runner,assert,evidence}` is a full assertion harness, dev-only — port it behind headless `POST /api/sessions` | L |
| ★ Trace Replay Debugger | Scrubable timeline of statements/yields + "re-run from statement 17 with my edits" | Persisted sessions + `GET .../sessions` (`projects.ts:405-450`) shipped; sidebar hardcodes "Conversations (0)" (`studio-sidebar/index.tsx:301-312`) | M/L |
| ★ Publish from Studio | One button: package the space, write the manifest block, PR to the store via the backup GitHub App | `github-app.ts#mintInstallationToken`; deterministic catalog generator; 13 integration spaces prove the shape | M/L |
| Space Time Machine | Per-space history, diff, one-space rollback | Studio saves are a debounced whole-space wipe-and-rewrite with no undo; backup already keeps a real git dir with SHAs; restore today is all-or-nothing | M |
| Architect Dry-Run | Synthesis writes to a staging dir; user reviews the file-by-file diff before register | Architect writers resolve via `resolveSpaceDir` (one-function re-point); `07-register.md` is the natural approval boundary | M |
| Live Space Lint | `validateSpace` as an always-on editor panel | `loadSpace` is fail-loud; today's feedback loop is edit → save → sync → create session → crash; the Studio VFS already holds the whole space in memory | S |
| Capability Inspector | Per-space blast-radius panel (capabilities, unlocked globals, delegation graph, events, env), identical in Studio and on the store listing | `parseCapabilities`, DTS fragment registry, and the catalog's lifted surface — generated "so an agent can fit-check from catalog data alone", unused by any human UI | S/M |
| Versioned spaces + 3-way merge | Semver + changelog; diverged installs get base/yours/new merge instead of `force:true` "throw away your work" | `.installed.json` `sourceHash`, `hashSpaceDir`, the divergence guard — the base bytes are recoverable, so a real merge is nearly free | M |
| Fork & Remix | "Start from this space" + a one-line adaptation brief to the architect | `iterate_space {spaceKey, feedback}`; `installStoreSpace` materializes; dynamic registration makes the fork callable same-session; 13 near-identical integration siblings are the sweet spot | S/M |
| Build-from-Spec in Studio | Drop a markdown spec, watch the 18-node build DAG live with the acceptance table and dataGaps | The DAG nodes have `dependsOn` + typed outputs (a renderable graph); `automation/app`'s ScenarioDetail UI is liftable; `check_acceptance`'s dataGaps is actionable feedback currently log-only | M/L |

### C. Integrations & automation

| Idea | Pitch | Builds on | Size |
|---|---|---|---|
| ★ Automation Weaver | "When a Stripe payout lands, post it in #finance and log it" → installed, running automation | finder fit-check → consent `installSpace` → architect `writeEventFile`+`writeHookFile` → republish re-arms webhook manifest + crontab. Risks: pod-global webhook path uniqueness needs a namespace allocator; `emit()` is pure/capability-less so the recipe needs a ❌-never example | L |
| ★ Personal Endpoint | Installable space: n named inbound URLs + shared-secret header emitting `request.received` — "your address on the internet" | The broker verbatim (`inbound.ts`; `GET /` already returns baseUrl+token+bindings); data-only `header-equals` verify. Unlocks Shortcuts/Zapier/Grafana/ESP32 without a space per provider | S/M |
| ★ Automation Console | Live app: every emitter/hook, last-fired, volume, pause switch, raw payloads, **replay** | `scanEmitterDefs`; `hooks-state.json`; `integration-lmthing/hook.fired` telemetry; the automator builds the app itself. Self-authored automation is only shippable if it's inspectable and killable | M |
| Home Assistant space | Fills the `casa/` stub with zero new runtime machinery | The self-hosted `apiBase {env,suffix}` pattern of mattermost/nextcloud/synology; HA webhook automations point at the inbound URL | M |
| Watcher | Generic cron poller diffing anything (RSS/ICS/JSON/price/HTML) into events | `CronEmitterCtx.state` persisted-KV cursor (~256KB, boot catch-up) — the most under-exploited primitive in the codebase; tier cron floors are the natural upsell | M |
| GitHub/Google event sources | `issue.opened`/`pr.review_requested`/`ci.failed`; calendar `event.starting_soon`, `mail.received` | The GitHub builtin verifier is registered and unused — the emitter is one file away; Google via cron polling + cursor. "Brief me before meetings" needs only this | S–M |
| Relay | One THING across all 13 messengers; bridge threads between surfaces | All messaging spaces normalize to the same `message.received {text, from, chatId, threadKey}`; threadKey → per-thread persisted session is exactly bridge continuity. Needs an echo guard | M |
| Self-tuning briefings | Cron digest that rewrites its own `daily: 'HH:MM'` when you never open the 6am one | `writeEventFile` — an automation product that can edit its own schedule; hook `budget` bounds cost | M |
| Pod self-ops | Wrap the orphan `session.started`/`agent.delegated` signals; "hook errors 3× in an hour → DM me and pause it" | Pure userland space; self-trigger suppression already exists; the data source for the Console | S |
| Inbound Email | A real address for the pod; `In-Reply-To` → threadKey makes an email thread a multi-turn session | The broker + `hmac`/`header-equals` verify; the only channel where non-technical household members can reply frictionlessly | M |
| MQTT/LAN bridge | User-run binary forwarding local IoT topics to the inbound URL | The broker + rate-limit bucket (bridge must batch). Stretch — ships a distributable binary | L |

### D. Collaboration, sharing, monetization

| Idea | Pitch | Builds on | Size |
|---|---|---|---|
| ★ Publish-from-pod | "Publish this space" in THING → it appears in the store under your handle | `StoreResolver.republish?()` declared/unimplemented; `.installed.json` update semantics designed; `lmthing` package block = listing metadata; backup credential-helper = pod→remote precedent | L |
| ★ Public channels → social | Flip a team channel public; transcript renders at `lmthing.social`, indexable, "run this yourself" CTA | Append-only channel JSONL + WS hub + `@thing` per-thread already run privately; public read = flag + unauthenticated GET of the tail; readers' turns bill to their own principal | M |
| ★ Send-a-space | "Share this space with alice@…" → claim link → consent → materialized in her pod | `team_invites` capability rows (expiry, single-use, pre-account claim); `installStoreSpace` engine with a gateway-held bundle; recipient consent free (`installSpace` is consent-marked) | S/M |
| Paid listings + payouts | Price in the manifest; entitlement check at the single shared install engine; Stripe Connect payouts | `subscriptionPrincipal` proves the multi-customer-class pattern; depends on publish | L |
| Team apps on lmthing.team | Serve app *pages* (not just API) to team members | Explicitly deferred in the teams handoff ("needs a cookie story"); the policy decision is made, only transport missing. "A team pod can build an app nobody on the team can open" | M |
| Per-seat pricing + spend attribution | Seats via `team_members`; per-member usage table | Edge already projects `x-user-id`/`x-user-email`; `SessionEntry.ownerId` stamps ownership; tag LiteLLM calls with the caller | M |
| Domain auto-join + admin role | `@acme.com` signups land in Acme's team; separate "configure" from "edit" | Invites are email-keyed and claimed at login — a `team_domains` table slots into the same resolution point; there is no mailer, so auto-join removes the manual-link cliff | S/M |
| Team credential vault | Editor approves a connection once; `@thing` in channels can actually use it | Headless runs fail closed on consent today → the channel agent can't file the ticket. Follow the `LMTHING_TEAM_MODE` container-env trust pattern. Highest functional value per line | M |
| Fork-a-workspace | Clone a whole configured pod (projects, spaces, channels, app data) as a template | Backup already treats the root as a git work-tree with secrets excluded and DBs as restorable `.sql`; a fork is a restore from someone else's branch. The consultancy/agency SKU | M/L |
| Tier ladder fix + metered top-ups | Fix the inverted budgets; sell overage credits instead of hard rejection | Nothing but budgets/pod/cron is tier-gated — seats, publish rights, backup frequency are unused packaging levers; top-up = budget bump + one-time charge on the single webhook path | S+M |

### E. Runtime-architecture-enabled

| Idea | Pitch | Builds on | Size |
|---|---|---|---|
| ★ Replay | Re-run any trace bit-for-bit, zero spend, zero side effects; then change one thing and branch | Trace carries model text + yield args + resolved values; mock provider sits upstream of the tracer; `TurnLoopDeps` takes injected `streamFn`/`processYield`. Missing piece: a `processYield` override seam on `SessionOpts` | M |
| ★ Preview Mode | Whole program runs against shadow resolvers → one typed diff ("3 tables, 12 rows, 2 pages, 1 gmail call") approved once | One injection site; mutators funneled (`buildScopedDb`, `writeProject*`, yield-router resolver map); hangs on the existing consent card | M/L |
| ★ JIT capability elevation | `Cannot find name 'emitEvent'` → consent card → grant for session → DTS rebuilt → retry succeeds | `runTsc` structured diagnostics; `sandboxApiHint` is already a pattern-match hook; `CAPABILITY_DTS_FRAGMENTS` maps identifier→capability; fail-closed consent means forks can't self-elevate | M |
| Capability right-sizing | Compute exercised globals from a trace, emit a narrowed profile, *prove* it by replay | "Not granted ⇒ not in DTS" makes too-narrow a compile error, not a runtime surprise | S/M |
| Agent contract tests | `describe.agent()`: scripted mock + assertions over the trace tree (fork counts, yield kinds, salvage flags, cost ceiling) | mock-provider + trace-tree + the ad-hoc salvage assertions in `orchestrator.test.ts` — packaging, not invention. Fills the gap between unit tests and minutes-long live scenarios | S/M |
| Cassettes | VCR for the yield router: record `{args → value}` once, replay offline; model and world independently swappable | `fetch` is already a yield; `sleep` takes an injectable clock; close `randomUUID`/`randomBytes` determinism gaps | S |
| Model routing autotuner | Auto-pin the cheapest model each task node still passes on — quality signal is "did it compile", objective and free | `modelForRole`, `LM_MODEL_<ALIAS>`, per-request model override, ledger cost attribution, `typecheck_error` on the trace | M |
| Self-repairing instructions | Mine traces for recurring failure patterns → coach proposes an instruct/knowledge patch → verify by replaying the failing turns | Generalizes the `MODEL_HABITS` registry from syntactic to behavioral; a closed learning loop with ground truth | L |
| Run Report | Shareable per-node artifact: cost/tokens/duration, retries, yields with values, and **the exact ambient DTS each node was given** | trace-tree + SessionLedger + `buildAmbientDts` (callable without a VM). The compliance/incident artifact nobody else can produce | M |
| Transactional turns | Journal a turn's mutations; roll back on `max_retries`/`eval_error` or user undo | Same choke points as Preview Mode; `turn_end` reasons are an exhaustive enum. `callConnection`/`apiCall` need a compensating-action model | L |

---

## Suggested sequencing

**Ship this month (S items with outsized effect):** wire `window.__SPACE_COMPONENTS__` in the
production chat (fixes a real silent degradation), GitHub/Google event source defs, Personal
Endpoint (fixed slots), Live Space Lint, pod self-ops space, Capability Inspector, tier-ladder fix,
Send-a-space.

**The two keystones to start now (each unblocks a family):**
- **Reachback** (notify + Inbox + push) — unblocks Open Loops, briefings, Drop Zone completion
  pings, pod self-ops alerts, and makes every existing scheduled hook visible.
- **Replay** — unblocks Preview Mode, contract tests, capability right-sizing, self-repairing
  instructions, and the Trace Replay Debugger.

**The strategic bets (pick one per quarter):** Automation Weaver (makes the event pipeline the
product), Publish-from-pod (creates the marketplace supply side; paid listings and fork-a-workspace
follow), Life Map (the non-imitable onboarding).
