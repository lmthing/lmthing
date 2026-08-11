# Teams — Claude Tag features: detailed implementation plan

Companion to [`teams-claude-tag-features.md`](./teams-claude-tag-features.md) (the research + gap map).
That doc says *what* to build and *why*; this one is the *how* — per feature: data model, gateway,
runtime, UI, tests, and the `org/docs` page that moves with it. Every path/symbol below was verified
against the checked-out runtime (`lmthing/org`) and gateway (`lmthing/cloud`) at the rebased HEAD.

**Ground rules that bind every workstream (do not restate them per item):**
- **Doc-in-the-same-change** (`org/docs/SYNC.md`): a new global → `org/docs/runtime-globals/team.md` +
  `library-dts.ts`; a gateway route → `org/docs/cloud/teams.md`; channel/WS behaviour →
  `org/docs/cli-api/rest/team.md`. Symbol anchors must resolve (`pnpm docs:check`).
- **Capability discipline:** a new agent power is a gated capability id in
  `libs/core/src/spaces/capabilities.ts`. Not-granted ⇒ not-injected ⇒ **absent from the DTS** ⇒ a
  retryable typecheck error, never a runtime throw. Keep the read/post split so forks stay
  least-privilege (`libs/core/src/exec/capability.ts#intersectAppCaps`).
- **Identity is caller-threaded, not ambient** — the member is captured from Envoy headers at the HTTP
  edge (`libs/cli/src/server/team-guard.ts#readCaller`) and passed as a *value* into
  `team-globals.ts#createTeamResolver`. Anything the agent does stays attributable.
- **Team pod gate:** team globals only exist when `LMTHING_TEAM_MODE=1`
  (`capabilities.ts#isTeamPod` / `team-guard.ts#isTeamMode`), set outside the editable `user-env`.
- **Design tokens only** in any new UI; **every fix ships a test** (`cd sdk/org && pnpm test <path>`).

**Legend for effort:** S ≤ 2d · M 3–5d · L 1–2wk · XL 2wk+.

---

## Architecture at a glance — where each concern lives today

| Concern | Module (repo) |
|---|---|
| Team lifecycle, roster, invites, billing, **token mint** | `cloud/gateway/src/routes/teams.ts`, `lib/tokens.ts` (§"Team tokens"), `migrations/010_teams.sql` |
| Channel/DM store, message shapes, mention resolve | `sdk/org/libs/cli/src/server/team-channels.ts` (`ChannelMessage`, `dmChannelId`), `team-members.ts#resolveMentions`, `team-reads.ts`, `team-push.ts` |
| The `@thing` turn from a posted message | `team-channels.ts#promptFor` → `routes/team-channels.ts#beginThingReply` → `runThingReply(caller)` |
| Per-turn team resolver (globals bound to caller+channel) | `sdk/org/libs/cli/src/server/team-globals.ts#createTeamResolver` |
| Agent-facing team globals + DTS | `sdk/org/libs/core/src/globals/team.ts`, `libs/core/src/typecheck/library-dts.ts#TEAM_READ_DTS` |
| Capability ids, team-pod gate, bare-only rule | `sdk/org/libs/core/src/spaces/capabilities.ts` (`TEAM_CAPABILITY_IDS`, `connections:use`, `store:install`) |
| Scheduling / proactivity substrate | `sdk/org/libs/cli/src/server/cron-manifest.ts`, `event-dispatch.ts`, `emit-event.ts`; DEFs via `emitter-def.ts` |
| Connectors (external tools) | `connections:use { providers }` capability + `callConnection`; consent card via the store/consent path |
| Realtime to clients | `sdk/org/libs/cli/src/server/ws/team-channels.ts`; UI in `sdk/org/libs/ui/src/team/*` |

> **Checkout note.** In `lmthing/`, `sdk/org` is an (empty) submodule; the runtime is editable in the
> sibling `lmthing/org` checkout. Gateway/migrations under `cloud/` are editable in place. A real branch
> doing this work runs `git submodule update --init sdk/org` (or lands runtime commits in `lmthing/org`
> and bumps the submodule pointer, matching `87078b4`-style bump commits).

---

## Phase 0 — Foundations (unblock everything)

### F1 · THING gets a real team principal — **L** — *blocks: ambient, agent-DM, audit-actor*

**Why.** Today a `@thing` message is `kind:'thing'` with **no `userId`**
(`team-channels.ts#ChannelMessage`), and `dmChannelId` hashes a sorted set of *user ids*
(`team-channels.ts#dmChannelId`) — so THING literally cannot be an addressable actor or a DM
participant, and an audit row can't say "actor = THING (ambient)". `runtime-globals/team.md` calls this
out as the precondition; do **not** fake it in the resolver.

**Design.** Mint one reserved principal per team, `thing@<teamId>` (a non-login synthetic user), at team
creation. Give it a stable id (e.g. `thing:<teamId>`) that the addressing scheme and audit log accept,
distinct from every human id.

**Work.**
1. *Schema* — `cloud/migrations/011_team_thing_principal.sql`: either a `thing_user_id` column on `teams`
   or a reserved row in `team_members` with a `principal_kind='agent'` discriminator. Backfill existing
   teams.
2. *Gateway* — in `routes/teams.ts` create-team path, provision the principal; in `lib/tokens.ts`
   (§Team tokens) allow minting a token whose subject is the THING principal for server-initiated turns
   (ambient/scheduled), scoped `role: 'agent'`.
3. *Runtime addressing* — extend `ChannelMessage` so a message can be *authored by* the THING principal
   (not just `kind:'thing'` reply text): add an optional `authorPrincipal` distinct from `userId`;
   teach `dmChannelId` to accept the principal id so a `(human, THING)` DM channel can exist.
4. *Resolver* — thread the principal through `createTeamResolver` so a server-initiated turn has a
   caller of kind `agent` rather than a spoofed human.

**Tests** (`team-channels.test.ts`, `team-globals.test.ts`, new `tokens.test.ts` in cloud): a DM channel
between a human and THING resolves and is visible only to that human + THING; a human-authored message
never collides with the THING principal id; token mint rejects `role:'agent'` from a human-facing route.
**Docs:** `org/docs/cloud/teams.md` (principal + token), `runtime-globals/team.md` (replace the "There
is no `teamDM`" section with the new model).

**Risk.** Addressing/visibility is security-sensitive (DM 404-not-403 invariant in
`team-channels.ts`). Land F1 behind a flag; no user-visible behaviour until F5/F6 consume it.

### F2 · Durable, learned channel memory — **M** — *blocks: memory-admin UI; feeds ambient*

**Why.** Claude Tag "learns your company over time." Today only the per-`(channel,thread)` session
snapshot exists; nothing accumulates at channel scope (gap #10).

**Design.** A per-`(team,channel)` memory doc — `facts`, `decisions`, `glossary`, `openLoops` — stored
under `<lmthingRoot>/.team/memory/<channelId>.json` (sits beside the existing `.team/` logs). Read at
turn start, written at turn end, **compacted on a token budget** (summarise oldest facts) so it can't
grow unbounded. This is distinct from ephemeral session snapshots and survives session resets.

**Work.**
1. *Store* — `libs/cli/src/server/team-memory.ts`: `readChannelMemory(root, channelId)`,
   `writeChannelMemory(...)`, `compactChannelMemory(...)` (LLM-summarise over budget, reusing the
   session summariser pattern).
2. *Capability + globals* — reuse the read/post split: expose read via a new `teamMemory()` under
   `team:read`, write via `teamRemember(patch)` under `team:post` (or a dedicated `team:remember` if we
   want summarisers to read-not-write; default to folding into `team:post`). Add DTS in
   `library-dts.ts#TEAM_READ_DTS` / the post fragment.
3. *Resolver wiring* — inject current channel memory into `createTeamResolver`; on turn end, persist the
   agent's memory patch.

**Tests:** a fact written in thread A is returned by `teamMemory()` in a later thread B of the same
channel; compaction keeps the doc under the byte budget while preserving the newest N facts;
`team:read`-only fork can read memory but `teamRemember` is a typecheck error in that fork.
**Docs:** `runtime-globals/team.md` (new globals + capability), `cli-api/rest/team.md` (storage layout).

---

## Phase 1 — Governance floor (must precede ambient/connectors)

### F3 · Per-channel + org spend caps with stop-and-notify — **M** — *closes #16*

**Why.** Ambient and connectors can burn budget unattended; caps are the safety valve Claude Tag ships
($ caps that halt and notify). Today a team has one budget, no per-channel cap, no stop-and-notify.

**Design.** Two limits — org-level and per-channel — checked before every team turn (tagged, ambient, or
scheduled). On breach: abort the turn cleanly and post a `kind:'thing'` message naming the cap, current
spend, and who can raise it. Reset at billing-period boundary.

**Work.**
1. *Schema* — `migrations/012_team_spend_limits.sql`: `org_cap_cents`, per-channel caps table
   (`team_id, channel_id, cap_cents`), and a period-scoped usage rollup (or reuse existing usage
   tables in `cloud/gateway`).
2. *Gateway* — `routes/teams.ts`: `GET/PUT /api/teams/:id/spend-limits`, `GET .../usage?by=channel`.
   Enforce in the usage-accounting middleware that already meters team turns.
3. *Runtime* — a pre-turn guard in `routes/team-channels.ts#beginThingReply` (and the ambient/scheduled
   entry from F5/F6) that asks the gateway "may this channel spend?" and, if not, short-circuits to the
   notify-post instead of starting the session.

**Tests:** a channel at its cap yields a single notify message and **no** model turn; org cap enforced
across two channels; caps reset across a simulated period boundary.
**Docs:** `org/docs/cloud/teams.md` (limits + usage-by-channel), `cli-api/rest/team.md` (the notify
message shape).

### F4 · Agent-action audit log — **M** — *closes #17; needs F1 for the actor*

**Why.** "A log of everything @Claude did and who asked." Channel JSONL logs exist but aren't a
queryable, attributed action feed.

**Design.** Append an audit event for every team-agent action — turn start/end, `teamPost`,
`teamCreateChannel`, `teamPinApp`, connector/tool call (F7), ambient post (F5), approval decision
(F8) — each carrying `{ actor: memberId | 'thing', channelId, action, costCents, ts, refs }`. Store
append-only under `.team/audit/*.jsonl`; expose a filtered read to admins.

**Work.**
1. *Emit* — a thin `auditTeamAction(...)` sink called from `createTeamResolver` hooks and the pre/post
   turn path in `routes/team-channels.ts`. Cost pulled from the same meter as F3.
2. *Read API* — `GET /api/team/audit?channel=&actor=&since=` (pod-side, editor-gated via
   `team-guard.ts`), plus an admin export.
3. *UI* — an "Activity/Audit" tab in team settings (`libs/ui/src/team/*`), tokens-only.

**Tests:** every global that mutates shared state produces exactly one audit row attributed to the
caller (or `'thing'` for ambient); DM-scoped actions are visible only to participants + admins; export
is stable/paginated. **Docs:** `cli-api/rest/team.md` (audit route), `cloud/teams.md` if any control-plane
mirror.

---

## Phase 2 — The headline differentiators

### F5 · Ambient / proactive mode — **L** — *closes #12; needs F1 + F3 (+ F4 to record it)*

**Why.** The signature Claude Tag feature: posting **without being tagged** — catch-ups, stalled-thread
nudges, forgotten action-items.

**Design.** Per-channel `ambient: boolean`, **off by default, editor-gated**. A low-frequency scheduled
scan wakes THING with a *no-mention* turn that evaluates recent channel state + channel memory (F2) and
**optionally** posts. Must be cheap when it decides to stay silent; every ambient post is visibly marked
"proactive" and recorded in the audit log (F4); each scan is a spend event subject to F3.

**Work.**
1. *Scheduler* — reuse the cron substrate: register an internal cron emitter DEF
   (`emitter-def.ts` / `cron-manifest.ts`) per ambient-enabled channel that fires
   `event-dispatch.ts`/`emit-event.ts` into a new **ambient turn entry** in `routes/team-channels.ts`
   (today only `beginThingReply` starts a THING turn — add `beginAmbientTurn(channel, thingPrincipal)`).
2. *Decision gate* — the ambient turn runs a cheap "is there anything worth saying?" pass first; on "no"
   it ends without a post (and without a full expensive turn where possible).
3. *Config* — `PUT /api/team/channels/:id { ambient }` (editor-gated); channel config field in
   `team-channels.ts`.

**Tests:** enabling ambient on a channel with a stalled thread yields one clearly-marked proactive post;
a quiet channel yields none; disabling reverts to mention-only; ambient spend hits F3; ambient post is
audited as actor `'thing'`.
**Docs:** `cli-api/rest/team.md` (ambient config + the scheduled entry), `runtime-globals/team.md` (the
no-mention turn), `system-spaces/README.md` if THING's instruct changes.

### F6 · Agent ↔ person DM (1:1) — **M** — *closes #19; needs F1*

**Why.** Claude Tag supports a private 1:1 with Claude. Deliberately impossible until F1 (no principal).

**Design.** With the F1 principal, a `(human, THING)` DM channel is a normal DM whose members are the
human id + the THING principal id. The human tags/talks to THING there privately; THING replies as its
principal. Reuse the entire existing DM machinery (visibility 404-not-403, unread badges, push).

**Work.** Mostly falls out of F1: allow `dmChannelId([userId, thingPrincipalId])`; a route to open/get
the THING DM; ensure `resolveMentions`/push treat the principal correctly; UI surfaces THING in the DM
list. Until F1 lands, "reach one person" stays a `teamPost` with an `@handle` (already works —
`team-members.ts#resolveMentions`).

**Tests:** a human's THING-DM is invisible to other members (404); THING replies attributed to its
principal, never to the asker; badges/push fire. **Docs:** `runtime-globals/team.md`, `cli-api/rest/team.md`.

### F7 · Per-channel connectors + admin tool/data/repo allow-list — **L** — *closes #14/#15*

**Why.** Claude Tag reaches GitHub/Drive/Jira/… via one org credential, admin-scoped per channel,
inheriting the credential's permissions.

**Design.** Build on the existing `connections:use { providers }` capability + `callConnection` and the
store/consent path. Add **team-level** connections (owned by the team principal, not a member) and a
**per-channel allow-list** of which providers/repos/data each channel may reach. The channel scope is
enforced server-side in the resolver from channel config (like team scope is caller-derived), not via
capability config — so the DTS still only advertises what the channel is allowed to call.

**Work.**
1. *Team connections* — team-scoped credential storage in the gateway (reuse connection storage; owner
   is the F1 principal). Editor connects a provider once for the team.
2. *Per-channel scoping* — channel config `connectors: { providers: string[], repos?: string[] }`;
   `createTeamResolver` intersects the agent's `connections:use` grant with the channel's allow-list and
   builds the DTS/injection from the intersection (not-allowed ⇒ absent from DTS in that channel).
3. *Consent* — reuse the consent card for first use of a connector in a channel; approvals recorded in
   F4.

**Tests:** a provider enabled for #eng but not #general is callable by THING only in #eng (typecheck-
absent in #general); repo allow-list is enforced (a call outside it fails at the resolver, not advisory);
team credential never leaks a member's personal token.
**Docs:** `runtime-globals/events-and-integrations.md` / `store-and-consent.md`, `cli-api/rest/team.md`,
`cloud/teams.md` (team connections).

### F8 · Human-approval gates for consequential outputs — **M** — *closes #18; needs F7*

**Why.** Claude Tag lets admins require sign-off before outputs become tickets/PRs/customer messages.

**Design.** Classify a THING action as *consequential* when it would write through a connector (F7) that
creates an external artifact (issue/PR/email/customer message). Route it through an in-thread
approve/deny card before it fires; nothing external happens until an editor approves; denial is recorded
(F4). Reuse the `@consent` primitive already in the event pipeline (`yield-router.ts`/`capabilities.ts`
consent path) rather than inventing a new gate.

**Work.** A policy map (per team/channel) of which connector actions require approval; an approval yield
that posts the card and suspends the action; wiring to fire or drop the connector call on the decision.
**Tests:** a "create GitHub issue" action posts a card and creates nothing until approved; deny leaves no
external artifact and audits the denial; a non-consequential post (plain `teamPost`) is never gated.
**Docs:** `format/space/events/README.md` (consent applied to team outputs), `cli-api/rest/team.md`.

---

## Phase 3 — Parity & polish

### F9 · Staged-plan artifact in team chat — **S/M** — *closes #9; reuses the dynamic plan*
THING already maintains a live checklist via `todoWrite` → `checklist` descriptor
(`render-descriptor.tsx`, glyphs `☐/◐/☑/✗`; kept live by `openPlanReminder`). **Surface that same
descriptor in the team channel view** so members watch THING work the plan — Claude Tag's "follow along
in the thread" UX. Work: ensure the team message renderer routes `checklist` descriptors through
`renderDescriptor`/`DisplayBlock` (it already should on team pods); add a compact in-thread affordance.
Tests: a team `@thing` turn that calls `todoWrite` renders checkboxes in the channel. Docs: `chat/views.md`
(already documents the descriptor renders on team pods — verify and cite).

### F10 · Scheduled / deferred agent tasks ("do this later / on a cron") — **M** — *closes #13; shares F5's scheduler*
Let a member ask THING to run something later or on a schedule, bound to a channel. Reuse the cron
emitter DEF path (`cron-manifest.ts`/`event-dispatch.ts`) that F5 already wires, but user-initiated and
one-shot-or-recurring. Add a `teamSchedule(when, prompt)` under `team:post`, and a management surface
(list/cancel). Every fire is spend-metered (F3) and audited (F4).
Tests: a scheduled task fires once at time T into the right channel and is cancellable; recurring stops
at cap. Docs: `runtime-globals/team.md`, `cli-api/rest/team.md`.

### F11 · Member-access modes + "may invoke THING" capability — **M** — *closes #8/#20*
Beyond viewer/editor, add access modes governing **who may invoke THING** (whole team / editors only /
a named role), matching Claude Tag's three access models. Schema in `010_teams.sql`
(extend/`013_team_access_modes.sql`); enforcement in `team-guard.ts` at the post-message edge (reject a
`@thing` invocation the caller's mode disallows, 403). Tests: a viewer in an editors-only channel cannot
start a THING turn; the roster's last-editor rule still holds. Docs: `cloud/teams.md`, `cli-api/rest/team.md`.

---

## Dependency graph & recommended sequencing

```
F1 principal ─┬─> F5 ambient ──> (F10 shares scheduler)
              ├─> F6 agent-DM
              └─> F4 audit (actor)
F2 memory ────────────────────> F5 (context) , F8 (recall for policy)
F3 spend caps ────────────────> F5 (safety) , F10
F7 connectors ────────────────> F8 approval gates
F9 / F11 independent polish
```

1. **F1 + F2** (principal, memory) — nothing headline is clean without them.
2. **F3 + F4** (caps, audit) — the governance floor ambient/connectors require.
3. **F5 + F7** (ambient, connectors) — the two most visible gap-closers.
4. **F6, F8** (agent-DM, approvals), then **F9–F11** parity polish.

## Cross-cutting test & rollout strategy
- **Unit-first**, per the repo rule — pure logic (memory compaction, spend math, access-mode decisions,
  ambient "worth saying?" gate) extracted to pure functions with co-located `*.test.ts`, mirroring how
  `plan-reminders.ts` is testable without booting a Session.
- **Flag every phase.** F1's addressing change and F5's ambient posting are the two highest-risk seams;
  land dark, enable per-team.
- **`pnpm test:native`** whenever `@lmthing/ui` team components change (audit tab, ambient marker, THING
  in DM list, in-thread checklist).
- **Security invariants to guard in tests:** DM visibility stays 404-not-403; the team credential (F7)
  never resolves to a member's personal token; the THING principal id (F1) can never be spoofed by a
  human-authored message; ambient/scheduled turns are metered and capped exactly like tagged turns.

## Open questions for product
1. Ambient cadence & cost ceiling — fixed interval, or event-driven (on new message in a watched
   thread)? Default cap for ambient specifically?
2. Memory correction UX — do editors edit raw facts, or approve/reject agent-proposed memory writes?
3. Connector credential ownership — strictly team-owned (recommended), or may a member lend a personal
   connection to a channel (weaker isolation)?
4. Approval policy granularity — per connector, per action-type, or per channel?
