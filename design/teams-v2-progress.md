# Teams v2 — scenarios, team-only THING, and the UX pass

Started 2026-07-31. Owner request: *"create full scenarios for team and fully test everything. fix
everything you find. the thing for team must have access to special functions for team only
features. Optimize the experience of the whole team application. … Add multiple scenarios where the
users use the thing agent and ask them to update project/apps. Optimize the ux when communicating
with THING about stuff. Make the TEAM app great. … ui features must also work on mobile. Also make
sure that app building should happen using the view spec app builder."*

> The root [`PROGRESS.md`](../PROGRESS.md) belongs to the concurrent **app-builder v2 /
> `system-viewbuilder`** work. This file is the teams lane and does not touch it.
> Everything factual about how teams work lives in [`org/docs/cloud/teams.md`](../org/docs/cloud/teams.md)
> and [`org/docs/cli-api/rest/team.md`](../org/docs/cli-api/rest/team.md) — this file is a work log.

## Where teams stood before this lane opened

Shipped and live-verified 42/42 on lmthing.team (2026-07-26, `design/teams-handoff.md`), plus four
THING-in-thread defects fixed 2026-07-31 (`design/thing-thread-parity-progress.md`) that have
**never been run against a real pod**. Baseline on entry: `team-channels` + `team-guard` +
`team-social` = **147 tests, all passing**.

## The four gaps this lane exists to close

1. **THING is team-blind.** In a channel it receives `[email in #channel] <text>` and nothing more
   (`sdk/org/libs/cli/src/server/team-channels.ts#promptFor`). There is no `team:*` capability in
   `libs/core/src/spaces/capabilities.ts` and no `libs/core/src/globals/team.ts`. It cannot see the
   directory, list channels, post anywhere but the thread it was called from, DM anyone, or read
   what the team decided last week.
2. **The team surface cannot be scenario-tested at all.** `scenarios/` drives a *personal* pod:
   one user, `/api/sessions`, the `/chat` shape. Nothing drives `/api/team/*`, channel threads, or
   several members sharing one THING session.
3. **The conversational UX of THING-in-a-channel is unaudited** against the far more developed
   `/chat` surface, on desktop and on a phone.
4. **App building in a team has never been pointed at the view-spec builder**, which is the one
   path whose apps render natively on the phone.

## Waves

| Wave | Work | State |
|---|---|---|
| 1 | GLOBALS · HARNESS · UX-AUDIT | ✅ all three |
| 2 | Team runner · play 20-studio + 21-newsroom · Part-B fixes | ✅ |
| 3 | Fix what the runs found · prompting + tasklists · rerun | 🔄 reruns in flight |

## Fixed, each with a test verified failing first

| # | defect | commit |
|---|---|---|
| 1 | free-tier pod sized to **135%** of its memory limit | `39a1e436` lane |
| 2 | the crash path dropped the `mentions` stamp, so a failure never reached the asker | `db5989cd` |
| 3 | a bad pagination cursor returned the newest page and said `hasMore: true` — an infinite loop | `70d8ea81` |
| 4 | the app card fired only on first build; every **update** was silent | `bf2953d5` |
| 5 | the history fallback survived in `runHeadlessThreaded`, so a channel posted the agent's TypeScript | `1c3ef2a1` |
| 6 | threaded turns were absent from the session ledger (**753k tokens** for one turn, unrecorded) | `39a1e436` |
| 7 | threaded turns never finalized their ledger record — stuck at `running` for ever | `1c3ef2a1` |
| 8 | a turn that gave up after its final retry was reported `ok: true` | `58999ec5` |
| 9 | **B4** parked ask had no id, no status, no bound; any reply consumed it | `0278ce54` |
| 10 | **B8** no ordering key, no idempotency key | `0278ce54` |
| 11 | **B9** read state derived from a file mtime | `0278ce54` |
| 12 | a viewer was refused only if the agent chose to — now the grants are withheld | `8cb910e7` + `7051ffc8` |
| 13 | a channel showed a member `"Lifetime not alive"` | `e23f144a` |
| 14 | THING could not create a channel, so "give it a room of its own" was unsatisfiable | `9977beb0` |

### The pattern behind 5, 6 and 7

Three defects, one shape: **a fix landed on one of two near-identical tails and not the other**, and a
team channel is the only caller of the one that keeps being missed. The per-path tests could never
catch it — they all passed throughout, sitting on opposite sides of the divergence. There is now a
test that asserts `runHeadless` and `runHeadlessThreaded` **agree**, and that records the one place
they deliberately differ so it stays a decision rather than becoming the fourth instance (`76cc06c6`).

### The viewer, and why prose was not enough

Both outcomes were observed on the same day. In 20-studio, Rita asked THING to mark a job invoiced:
the turn read her role, ignored it, ran `display(db.tables())` and settled `done` — her reply was the
two words `jobs press_checks`. In 21-newsroom, Joan got a proper role-based refusal. Same rule, same
code, two answers, because the rule was **advice**: the role arrives as data and the agent held
`db:write` regardless.

`SessionOpts.readOnly` withholds the grants, reusing the read-only fork gate (`intersectAppCaps`)
rather than inventing a second one — the two questions are the same question. Not granted ⇒ not
injected **and** absent from the DTS, so a write is a typecheck error the model sees. It fails closed
when no verified caller reached the pod.

## Three team tasklists — guarantees, not instructions

`user-thing` had eight tasklists and none about the team, so every team job was improvised in one
turn. The new three put the failing step in a node that **cannot** do its neighbours' work:

- **`tell_the_team`** — the nodes that choose the channel and write the wording are `role: explore`
  with `team:read`, and `intersectAppCaps` strips `team:post` from a read-only role, so they cannot
  post. A first-class `"here"` verdict means "the only place is the channel I am already in" can
  never be reported as a delivery — which is exactly what went wrong live.
- **`answer_from_team_record`** — every node read-only; rules out the thread in front of it as a
  source, and a required `checked` field makes "there is no record of that" sayable only by something
  that looked.
- **`settle_team_decision`** — a fork has no `ask()`, so the terminal node holds `capabilities: []`
  and returns a verdict that is **not a reply**. THING cannot end a turn on it.

A class guard walks every node of every shipped space: `team:post` is reachable from exactly one.

## Still open, and honest about it

- **1-in-14 restraint slip** — THING builds on the offer turn. Not the surface (measured 14 ways).
- **The builder switch** — needs an owner decision on whether an existing app's builder is fixed
  structurally; the strongest option lives in the frozen `system-appbuilder`.
- **Two silent turns** in 21-newsroom — `0 statements` on "yes, do that". The most damaging finding
  of that run, since everything downstream tested against state never built. Unexplained.
- **The `Lifetime not alive` disposal race** — presentation fixed, root cause not. No repro.
- **`display(rawValue)` as a channel reply** — cannot be gated on content.
- **The upload authorization gap** — must close *before* attachments ship, not with them.

### HARNESS — delivered and live-verified

`TeamPod` (every call made **as** a named member, identity headers injected), `TeamSocket` (the WS
upgrade and RFC-6455 decode written by hand — Node's global `WebSocket` cannot set request headers
and `ws` is not resolvable from this workspace package, and identity on the socket is load-bearing
because DM events fan only to participants), `ThreadSession`, and `startRun({teamMode})` added
additively so every existing caller spawns a byte-identical server.

`scenarios/harness/team-smoke.mjs`: **32/32 checks against a live LLM**, four real runs. It settles
things no unit test could, and in particular **pod-verifies the four THING-in-thread fixes that
`design/thing-thread-parity-progress.md` had only ever proved by reading**:

- Bo's turn resolved to **Ana's `sessionId`** and carried a fact only her turn supplied — with no
  `@thing` in his message. Cross-member thread memory is real.
- A real `ask()` **parked for 40.9 s**, was stored as blocks (a `RadioGroup`, not prose), was settled
  by a plain reply, and teardown did not hang.
- A viewer was refused channel and category writes while keeping the right to talk, and nothing was
  written.

The completion signal is the `thing_status` terminal, **not** "a `thing` message appeared": a parked
`ask()` is stored as a `kind:'thing'` message too, so stopping at the first one reports a suspended
turn as finished and hands back the question as the answer.

### AUDIT — delivered as a handover

`design/teams-ux-audit.md`. Verdict: **a channel is a send-only surface with a hidden reply** — you
cannot stay scrolled up (A1), cannot reach anything past 50 messages (A9), and the answer to the
question you just asked does not appear on the screen you asked from (A3).

Part A (rendering) goes to the concurrent UI session, each finding carrying the pass condition their
screenshot gate must show. Part B is this lane:

| | |
|---|---|
| B3 ✅ | **verified sound** — `blocks` do preserve structure, same `renderDescriptor` as `/chat`, no source-as-answer fallback |
| **B6** ✅ | **fixed** (`db5989cd`) — the crash path dropped the `mentions` stamp *and* the `deliver()` call, so the one outcome you most need telling about was the only one that never badged you or reached your phone. Distinct from `ok:false`, which returns normally and was stamped all along; only a **throw** lost the address. Test verified failing first |
| **B10** ✅ | **fixed** (`70d8ea81`) — `readMessages` discarded an unmatched `before` (`void reachedBefore`) and returned the **newest** window while answering `hasMore: true`, so a client paginating with a bad cursor looped forever over the same page. The log is append-only and read whole, so there is no stale-cursor case to be kind to |
| B4 S1 | a parked ask has no `askId`, no `waiting` status, no timeout; **any** reply consumes it silently |
| B9 S2 | `hasUnread` is derived from the log file's **mtime**, so sitting in a channel while someone talks never marks it read — invisible in testing because your own posts do mark read. The smaller fix is client-side (a debounced re-`markRead` while the channel is on screen), which is the concurrent session's lane |
| B8 S2 | no ordering key (unserialized append, read in file order, client never sorts) and no idempotency key, so a retry duplicates |
| B5 S2 | the app card fires only when a project *gains* `pages/` — an **update** produces nothing |
| B2 S1 | `thing_status`/`activity` are never persisted: join mid-turn and you see nothing |
| B1 S1 | the socket has no message-update frame, no presence, no connection state, no resume cursor |
| B7 S2 | attachments — filed as [`.issues/team-upload-authorization-gap.md`](../.issues/team-upload-authorization-gap.md) |

Most of Part B lives in `libs/cli/src/server/team-channels.ts` and its route file, which the GLOBALS
agent holds — so these land after it does.

## Wave 1 — in flight

| Agent | Lane | Deliverable |
|---|---|---|
| GLOBALS | `libs/core/src/{globals,spaces,typecheck}`, `libs/cli/src/server/team-*` | a `team:*` capability + team-only globals, inert on a personal pod, viewer-safe, DM-safe |
| HARNESS | `scenarios/harness/**` | `TeamPod` (per-member identity headers), a channel-thread THING driver, team-mode `startRun`, and a `team-smoke.mjs` actually run against a live LLM |
| UX-AUDIT | read-only | `design/teams-ux-audit.md` — ranked, every finding cited `path:line`, with the THING-in-channel vs `/chat` gap list and a 390px/320px pass |

### Found while authoring, before any agent reported

**A team channel has no attachment path, and half of one shipped.**
`libs/cli/src/server/team-channels.ts` has no attachment handling and
`libs/ui/src/team/composer.tsx` contains no reference to one, while `/chat` accepts vision, audio and
files. But `team-guard.ts:84` already whitelists `POST /api/uploads` for a **viewer**, with the
reason written in the code as *"attach a file to a message"* — so the permission for the feature is
in, and the feature is not. That is why 20-studio opens with a conversation rather than a file dump:
writing an attachment beat would have tested a path that does not exist.

## Scenarios (Wave 2) — authored

| # | Scenario | The promise it proves | State |
|---|---|---|---|
| [20-studio](../sdk/org/scenarios/20-studio/scenario.yaml) | the THREAD is the unit of memory — Bo replies in Ana's thread with no `@thing` and must be answered with Ana's context | ✅ authored, 12 steps |
| [21-newsroom](../sdk/org/scenarios/21-newsroom/scenario.yaml) | the TEAM is the unit of work — a scheduled turn posts into a channel while nobody is typing, THING makes a room for a story and tells the two people on it, a DM answered from the same state | ✅ authored, 10 steps |
| [22-crossfire](../sdk/org/scenarios/22-crossfire/scenario.yaml) | concurrency — two uncoordinated changes must BOTH land, and a genuine contradiction must be surfaced to the people in it rather than decided by whoever finished last | ✅ authored, 8 steps |

All three parse with the repo's own YAML parser. The verb vocabulary they need beyond the shared
set: `as` · `in` · `dm` · `reply_to` · `answer_ask` · `concurrent`.

21-newsroom step 2 carries a deliberate **negative**: "readable on a phone" is a context, not a
requirement about how it must run, and THING must NOT switch builders on it. A suite that only ever
tested the positive would let the builder-routing line drift wider on every ambiguous phone mention.

## Planned runner

Team scenarios need verbs the personal runner has no concept of — *who* speaks, *which* channel,
*in a thread or not*, and a member who is only a viewer. They will be played by a team runner built
on the Wave-1 harness rather than by bending `run-scenario.mjs`, so the eight existing scenarios
keep behaving byte-identically.

App building in these scenarios routes to **`system-viewbuilder`** (explicit opt-in per the
app-builder-v2 owner decision), so the apps render natively on the phone.

## What the first live team scenario found, on step 1

`20-studio` run 1. The first team scenario ever played found a defect in its **opening message**.

**THING built a whole app before Ana accepted anything.** `runs/1/data/.lmthing/fold-studio-jobs/`
has `database/jobs.json`, `api/`, `pages/jobs`, `components/` — while the channel log still held
only Ana's message, 13 minutes into turn 1, with no reply. This is not a strict `expect`; THING's own
instruct forbids it in as many words
(`libs/core/system-spaces/user-thing/agents/thing/instruct.md` ~L781, ~L801):

> frustration is a cue to OFFER, never a licence to build … An OFFER turn ends with a question and
> contains **zero** authoring delegates … Then STOP and wait. Do not author anything on the same turn
> as the offer.

Ana's opener is a frustration ("we are drowning a bit").

**What it built was a job-application tracker.** `database/jobs.json` says "Holds job application
records", with `status` ∈ `saved · applied · interviewing · offered · accepted · rejected ·
withdrawn`, plus `title` ("e.g. 'Senior Frontend Engineer'"), `company`, `salary_min`, `salary_max`,
`contact_email`, `applied_at` — and studio fields bolted onto the same table (`client`, `owner`
"e.g. Almeida, Bo"). "Three jobs running" at a branding studio, alongside three named client
projects, "waiting on the client" and "goes to print", was read as job hunting.

### The hypothesis was measured, and refuted

The guess was that the **channel surface** causes it — a channel turn is `visibleToUser: true` and
deliberately not `interactive`, so nobody can answer an `ask()`, and an agent that cannot ask might
reason its way into just building. Measured with `scenarios/harness/probe-offer-restraint.mjs`,
which judges on the filesystem (did a project directory appear on the offer turn), the one signal
both surfaces share and the one a model cannot talk its way around:

| surface | authored on the opening turn | ended by asking |
|---|---|---|
| personal `/chat` | **0 / 5** | 5 / 5 |
| team channel, minimal cast | **0 / 6** | 6 / 6 |
| team channel, full 20-studio cast | **1 / 3** | 2 / 3 |

The identical full-cast configuration that built was replayed twice more and **offered correctly
both times** — 17 s and 28 s, `display` the only global, no project directory at all.

So: **1 in 14, and not a property of the surface.** The fix does not belong in `runThingReply`. It
is a low-probability restraint slip in THING itself, which means it reaches `/chat` users too — the
0/5 personal result is a sample size, not an acquittal.

Filed as [`.issues/thing-builds-on-the-offer-turn.md`](../.issues/thing-builds-on-the-offer-turn.md)
and, separately, [`.issues/thing-schema-domain-misread-job-tracker.md`](../.issues/thing-schema-domain-misread-job-tracker.md).
**Two files, not one**: the causal story above is untested, because the misread is n=1 and the 13
correct replays authored nothing and so produced no schema to compare. The cheap experiment that
would settle it (`--through 2`, so the offer lands, the `if_asked` answers arrive, and *then* it
builds) is named in the file.

The verify-a-fix gate requires **N runs, not one green run** — a single passing replay would have
"proved" this fixed at any point during the investigation.

### One correction to the first reading

"13 minutes into turn 1, no reply" was partly the harness, not the pod: `ThreadSession` waited on
channel frames, and a channel emits nothing between `setActivity()` calls, so a silent build read as
a hang. `await` now takes a liveness probe and the budgets are sized for a build. The authoring
finding is unaffected — it rests on the filesystem timeline (`project.json` 17 s after the opener,
`database/jobs.json` four minutes *before* Ana's acceptance), not on a timeout.

## The clean run (`20-studio` run 2) — steps 1 and 2

**Step 1 passes.** `spaces: []`, `appTables: {}`, `built: false`, `activeProject: user` — nothing
authored, the offer preceded the work, 34 s. Consistent with the slip being ~1 in 14 rather than
systematic.

**Step 2 passes, including the routing beat.** Ana's "run on the phone itself, not a website
squeezed into an app" reached the right builder:

```
delegates: ["user-memory/memory", "system-viewbuilder/automator#build_live_project"]
viewFacts: specCount 2 · routes [index, job-detail] · shellAuthored · endpointCount 4
native:    {status: 200, viewCount: 2, endpointsWithInputSchema: 4, wouldRenderNatively: true}
handAuthoredPages: []   routesWithoutSpec: []   malformed: []
```

and the rows are a faithful reading of the conversation, not a template:

| name | status | owner |
|---|---|---|
| Almeida | waiting on client | Bo |
| Trindade Bakery | ready for print | — |
| Serralves catalogue | **unknown** | Ana |

Serralves being recorded as `unknown`, with the note "State is genuinely unknown; Ana doesn't know
where this job stands", is the detail worth keeping: Ana said she did not know, and it wrote down
that she did not know instead of inventing a status.

**The ledger fix is confirmed live.** One record, `source: "team-channel"`,
**753,259 input / 40,965 output tokens** and three delegates with their models — for a single channel
turn that, before `39a1e436`, left no record at all.

### Evidence on the causal question, still not proof

Run 1 built on the offer turn and produced a job-application tracker. Run 2 offered first, received
Ana's acceptance and her context, and produced the studio's actual domain. That is the experiment
`.issues/thing-schema-domain-misread-job-tracker.md` names, and it points the way the hypothesis
predicted — but it is n=1 against n=1, so it stays a hypothesis with better evidence, not a finding.

### New finding — the app was built into the shared `user` project

`activeProject: user`, and `user` is the only project on disk; the specs are at
`.lmthing/user/pages/*.view.json`. THING's instruct says the opposite for an accepted offer
(`user-thing/agents/thing/instruct.md` ~L812): *"Still in the shared `user` project? Create the
dedicated project FIRST — propose the name"*. Run 1 **did** create `fold-studio-jobs`, so this is
inconsistent between runs rather than a considered team-mode behaviour.

## Lane boundary — the team UI is owned by a concurrent session

A separate Claude Code session is doing the team + chat **rendering** pass in this same worktree
(`design/team-chat-ux-progress.md`), and has built a screenshot gate — `pnpm shots`,
`sdk/org/apps/web/tests/surface-shots/` — that photographs the real surfaces at 390×844 and
1440×900 in both themes. That is the right owner for pixels, so this lane does not touch
`libs/ui/src/team/**`, `apps/web/src/routes/team/**` or `apps/mobile/**`.

The UX audit therefore lands as a **handover document**, split in two: rendering findings (theirs,
each with the pass condition their screenshot gate would have to show) and everything that is not
rendering — the pod, the protocol, what THING knows and does — which is this lane's.

`pnpm test:native` **PASSES** on `main` as of 2026-07-31. The note in the older design docs that
both native gates are red is out of date; mobile changes are provable again.

## Standing constraints

- **Everything local.** Per-run isolated `lmthing serve`, own port and data dir. Never prod.
- **A concurrent session shares this worktree.** Commit with `git commit --only <paths>`; never
  `git add -A`. Off-limits to this lane: `libs/cli/src/app/view-spec/**`,
  `libs/core/system-spaces/system-viewbuilder/**`, `libs/ui/src/view/**`, root `PROGRESS.md`,
  `design/appbuilder-viewspec-plan.md`.
- **`libs/cli/src/server/team-channels.ts` contains a raw NUL byte** — `grep` silently skips the
  whole file. Read it with python.
- Docs move in the same change as the code; `pnpm docs:check` and `pnpm lint:tokens` are hard gates.
