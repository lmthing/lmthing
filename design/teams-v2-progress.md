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
| 1 | GLOBALS · HARNESS · UX-AUDIT (parallel, disjoint paths) | HARNESS ✅ · AUDIT ✅ · GLOBALS 🔄 |
| 2 | Team runner + play the scenarios · Part-B fixes | 🔄 |
| 3 | Fix what the live runs find · re-run to green · docs + push | ⏳ |

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
| B4 S1 | a parked ask has no `askId`, no `waiting` status, no timeout; **any** reply consumes it silently |
| B9 S2 | `hasUnread` is derived from the log file's **mtime**, so sitting in a channel while someone talks never marks it read — invisible in testing because your own posts do mark read |
| B8 S2 | no ordering key (unserialized append, read in file order, client never sorts) and no idempotency key, so a retry duplicates |
| B6 S2 | the crash path drops the `mentions` stamp, so the person who asked is never badged about the failure |
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
