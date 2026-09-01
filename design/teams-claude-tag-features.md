# Teams — Claude Tag feature research & implementation list

**Status:** research + backlog. **Reference:** Anthropic's Claude Tag (Claude-in-Slack), announced
2026-06-23, running on Opus 4.8, GA-beta for Team/Enterprise. This doc distils what Claude Tag does and
maps each capability onto lmthing's **team** product (`@thing` in team channels), marking what already
exists, what is partial, and what is net-new — with the concrete code seam each item lands on.

> **Framing.** lmthing already ships most of Claude Tag's *surface* (Slack-like channels/DMs/threads, a
> shared agent you `@`-mention, per-thread memory, team-scoped billing, RBAC). Claude Tag's real
> differentiators over what we have are four: **(a) ambient / proactive mode**, **(b) durable learned
> channel memory that admins can inspect**, **(c) per-channel connectors + tool/data allow-lists**, and
> **(d) governance: spend caps, an audit log, and human-approval gates.** The backlog is ordered around
> closing those gaps.

---

## 1. What Claude Tag is (research summary)

- **Invocation.** `@Claude` in a channel or thread hands it a task; it decomposes the task into stages,
  works through them with whatever tools it has, and replies in-thread with the result. `@Claude` in a
  thread continues mid-conversation. DMs give a private 1:1.
- **Multiplayer / shared identity.** One Claude per channel, visible to everyone. It runs under an
  **organization-level identity** with its own auth — it acts *as the team*, not by impersonating the
  asker (contrast Claude Code, which assumes your identity). Anyone can pick up a thread where the last
  person left off, with no re-explaining.
- **Channel-scoped persistent memory.** Memory is per-channel and cumulative: Claude learns the team's
  terminology, project state, decisions and blockers over time. Admins can **view, edit, and delete**
  channel + workspace memory (Org settings → Claude Tag → Audit).
- **Ambient / proactive mode.** Admin-enabled, per-channel, off by default, owner-only. Claude posts
  *without being tagged*: surfaces relevant info from across connected channels/tools, follows up on
  stalled threads and forgotten action items, keeps the team caught up.
- **Async multi-step execution.** Breaks work into stages shown live in-thread, runs asynchronously
  across hours/days, and can schedule future tasks.
- **Connectors.** MCP connectors (GitHub, Google Workspace, Jira/Linear, Notion/Confluence, Salesforce,
  …). One org credential per tool, shared workspace-wide; admins pick which tools/repos/data sources are
  reachable, per channel. Claude inherits the credential's permissions.
- **Governance.** Owner-only install; three member-access modes (whole Slack workspace / whole Claude org
  / role-gated on Enterprise). Per-channel **and** org **spend caps** ($500 … unlimited) that stop and
  notify on hit; **audit log** of everything @Claude did and who asked; **human-approval gates** so
  outputs don't become tickets/PRs/customer messages without sign-off. Explicitly conversational, not
  auto-agentic in external systems.
- **Billing.** Consumption-based. Channel work bills the org balance; DMs bill the individual seat.

Sources: Anthropic "Introducing Claude Tag"; Claude Help Center "What is Claude Tag"; claude.com docs
(spend limits); TechCrunch, IT Pro, Engadget, DataCamp, Salesforce Ben coverage (2026-06/07).

---

## 2. Claude Tag → lmthing team: gap map

Legend: ✅ have · 🟡 partial · ❌ missing. Seams cite the documented implementation locations in
`sdk/org` (the runtime submodule) and `cloud/` (the gateway control plane).

| # | Claude Tag capability | lmthing today | Seam |
|---|---|---|---|
| 1 | `@`-mention a shared agent in a channel/thread | ✅ `@thing`; stable per-`(channel,thread)` session, follow-ups need no re-mention | `sdk/org/libs/cli/src/server/team-channels.ts#promptFor`, `routes/team-channels.ts#beginThingReply` |
| 2 | Multiplayer shared instance, visible to all, hand-offs | ✅ one THING per channel, activity streamed over WS | `sdk/org/libs/ui/src/team/*`, `ws/team-channels.ts` |
| 3 | Caller-attributed, non-impersonating identity | ✅ caller threaded from Envoy headers as a value | `team-guard.ts#readCaller`, `team-globals.ts#createTeamResolver` |
| 4 | Reads channel/thread history & directory for context | ✅ `teamContext`/`teamMembers`/`teamChannels`/`teamHistory` | `sdk/org/libs/core/src/globals/team.ts`, DTS `library-dts.ts#TEAM_READ_DTS` |
| 5 | Posts elsewhere / opens a channel / pins output | ✅ `teamPost`, `teamCreateChannel`, `teamPinApp` (app pinned beside channel) | `globals/team.ts`, gated on `team:post` |
| 6 | Least-privilege for sub-agents (read vs post split) | ✅ `intersectAppCaps` keeps `team:read`, drops `team:post` in forks | `sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps` |
| 7 | Team-scoped budget/credentials, not a member's | ✅ team pod, team Stripe customer, team-scoped JWT | `cloud/gateway/src/routes/teams.ts`, `lib/tokens.ts` |
| 8 | Two-tier RBAC | 🟡 viewer/editor only; no per-capability role for "may invoke the agent" | `cloud/migrations/010_teams.sql`, `team-guard.ts` |
| 9 | Multi-step task with staged progress in-thread | 🟡 live activity/status over WS, but no explicit plan→stages artifact or resumable job | `ws/team-channels.ts`, `SessionManager.runHeadlessThreaded` |
| 10 | Durable *learned* channel memory (accumulates over time) | 🟡 per-thread session memory only; nothing cumulative or channel-level | session snapshots; **no memory store** |
| 11 | Admin view/edit/delete of agent memory | ❌ | new — needs #10 first |
| 12 | **Ambient / proactive mode** (post without being tagged) | ❌ THING only ever wakes on a mention | `promptFor`/`beginThingReply` are mention-driven |
| 13 | Scheduled / future async tasks | ❌ no cron/deferred-turn for THING in a team | events pipeline exists (`events/*` cron emitters) but not wired to team THING |
| 14 | Per-channel connectors / external tools (GitHub, Drive, Jira…) | 🟡 `installSpace` + `callConnection` exist; not scoped/managed per channel for team THING | `runtime-globals` connections; store consent |
| 15 | Admin tool/data/repo allow-list per channel | ❌ | new — capability config + gateway admin |
| 16 | **Per-channel + org spend caps** that stop & notify | 🟡 team has a budget; no per-channel cap or stop-and-notify | `cloud/gateway` billing/usage on team |
| 17 | **Audit log**: what the agent did + who asked | ❌ (append-only channel JSONL logs exist, but no queryable agent-action audit) | `.team/` logs → new audit surface |
| 18 | **Human-approval gate** before outputs become tickets/PRs/messages | 🟡 `@consent` primitive exists in the event pipeline; not applied to team agent outputs | events-and-hooks `@consent` |
| 19 | Agent DMs a person 1:1 | ❌ deliberately not built — THING has no principal; `dmChannelId` hashes user ids | `team-channels.ts#dmChannelId`, see runtime-globals/team.md "There is no `teamDM`" |
| 20 | Member-access modes (who may invoke the agent) | ❌ any team member in a channel can | `team-guard.ts` |

---

## 3. Implementation backlog (prioritized)

Each item: **what**, **why it's the gap**, **where it lands**, **acceptance**. Effort is rough
(S ≤ 2d, M ≈ 3–5d, L ≈ 1–2wk) and excludes the doc update every change owes per `org/docs/SYNC.md`.

> **Prerequisite for this checkout:** the `sdk/org` submodule is not initialized here (`sdk/org/` is
> empty; the runtime lives in the separate `lmthing/org` checkout). Items touching runtime code need
> `git submodule update --init sdk/org` first. Gateway items (`cloud/`) are editable as-is.

### P0 — foundations that unblock the differentiators

**B1. A real THING team-principal (identity for the agent itself).** — **L**
- *Why:* Ambient mode (B4), agent→person DMs (#19), and an audit "actor = THING" (B7) all currently
  can't exist because THING carries no `userId`; every message is either the caller's or has
  `kind:'thing'` with no principal. This is the single biggest unlock.
- *Where:* extend `ChannelMessage`/addressing in `team-channels.ts` (`dmChannelId`, `resolveMentions`),
  mint a reserved principal in the gateway (`teams.ts` + `010_teams.sql`), thread it through
  `createTeamResolver`.
- *Acceptance:* THING can be a participant/actor addressable and attributable distinctly from any human;
  existing caller-attribution for tagged turns is unchanged.
- *Note:* runtime-globals/team.md calls this out explicitly as the precondition — do not fake it in the
  resolver.

**B2. Durable channel memory store.** — **M**
- *Why:* Closes #10 — the "learns your company over time" property, and prerequisite for admin
  view/edit/delete (#11).
- *What:* a per-`(team,channel)` memory record (facts/decisions/glossary/open-loops) the agent reads at
  turn start and writes to at turn end; separate from ephemeral session snapshots. Store under `.team/`
  on the pod, summarised/compacted on a budget.
- *Where:* new store beside `team-channels.ts`; inject into `createTeamResolver`; expose read via a
  `teamMemory`-style `team:read` global and write via `team:post` (or a dedicated `team:remember`).
- *Acceptance:* a fact stated in one thread is available to THING in a later thread of the same channel
  without re-stating; memory is bounded/compacted, not unbounded growth.

### P1 — the four headline gaps

**B3. Per-channel + org spend caps with stop-and-notify.** — **M**
- *Closes #16.* Extend the team budget in `cloud/gateway` with a per-channel cap and an org cap; when a
  channel turn would exceed, halt the turn and post a THING message naming the cap and who to ask.
  Surface per-channel usage in the team admin UI.
- *Acceptance:* setting a $ cap on a channel stops further agent turns there once hit and notifies the
  requester; org cap enforced across channels; usage visible per channel.

**B4. Ambient / proactive mode (per-channel, off by default, editor-gated).** — **L**
- *Closes #12.* Depends on **B1** (THING principal) + **B3** (spend cap, so ambient can't burn budget).
  Add a per-channel `ambient` flag; a low-frequency scheduled scan (reuse the `events/*` cron emitter
  path, #13) that lets THING evaluate recent channel state and *optionally* post: catch-up summaries,
  stalled-thread nudges, forgotten action-items. Must be cheap when it decides to stay silent, and every
  ambient post is clearly marked as unprompted.
- *Where:* channel config in `team-channels.ts`; scheduler via the events pipeline; a new
  ambient-turn entry that wakes THING without a mention (today only `beginThingReply` does).
- *Acceptance:* enabling ambient on a channel produces a periodic, budget-bounded proactive post only
  when there's something worth saying; disabling it silences THING to mention-only; audit (B7) records
  each ambient action.

**B5. Per-channel connectors + admin tool/data/repo allow-list.** — **L**
- *Closes #14/#15.* Build on `installSpace`/`callConnection` and store consent: let an editor connect an
  external tool (GitHub, Drive, Jira, …) at the **team** level and scope which channels may use it and
  which repos/data the agent may touch. One team credential, shared, inheriting the credential's
  permissions.
- *Where:* team-scoped connections in the gateway; capability config surfacing allowed connectors into
  the agent's DTS per channel; consent card reuse.
- *Acceptance:* a connector enabled for #eng but not #general is callable by THING only in #eng; repo
  allow-list is enforced, not advisory (typecheck-absent when not granted, per the capability model).

**B6. Human-approval gates for consequential outputs.** — **M**
- *Closes #18.* Wire the existing `@consent` event-pipeline primitive to team-agent side effects: any
  action that creates a ticket/PR/customer-facing message (via a connector from B5) routes through an
  approval step posted in-thread before it fires.
- *Acceptance:* a THING action classified as consequential posts an approve/deny card; nothing external
  happens until an editor approves; denial is recorded.

**B7. Agent-action audit log.** — **M**
- *Closes #17.* A queryable log of every THING action (turns, posts, tool/connector calls, ambient
  posts, approvals) with **who asked** (caller from B1/#3) and cost. Admin view in the team settings UI;
  underpins memory audit (B8).
- *Acceptance:* an admin can list, filter, and export what THING did in a channel over a window,
  attributed to the requesting member (or "ambient").

### P2 — governance polish & parity

**B8. Admin memory management UI (view / edit / delete).** — **M** — *Closes #11; needs B2.*
Team-settings surface to inspect and correct/delete channel + workspace memory, mirroring Claude Tag's
Audit panel.

**B9. Member-access modes + "may invoke agent" capability role.** — **M** — *Closes #8/#20.*
Add access modes (whole team / editors only / specific role) governing who can invoke THING, beyond the
current viewer/editor split. Schema in `010_teams.sql`, enforcement in `team-guard.ts`.

**B10. Staged-plan artifact for multi-step tasks.** — **S/M** — *Closes #9.*
Render the agent's task decomposition as a live checklist in-thread (stages ticking off as they complete)
rather than free-form status text — Claude Tag's signature "watch it work" UX. Builds on the existing WS
activity stream.

**B11. Scheduled / deferred agent tasks.** — **M** — *Closes #13; overlaps B4's scheduler.*
Let a member ask THING to do something later / on a cron; reuse `events/*` cron emitters bound to a team
channel turn.

**B12. Agent→person DM (1:1).** — **M** — *Closes #19; needs B1.*
Only viable once THING has a principal (B1). Until then, "reach one person" stays as a `teamPost` with an
`@handle` (already works). Deliberately deferred — see runtime-globals/team.md.

---

## 4. Cross-cutting notes

- **Every code change updates its `org/docs/` page in the same change** (`org/docs/SYNC.md`). New globals
  → `org/docs/runtime-globals/team.md` + `library-dts.ts`; gateway routes → `org/docs/cloud/teams.md`;
  channel/WS behavior → `org/docs/cli-api/rest/team.md`. New capability ids follow
  `@.claude/skills/new-global.md`.
- **Capability model discipline.** New agent powers (B2 memory-write, B5 connectors) are gated
  capabilities: not-granted ⇒ not-injected ⇒ absent from DTS ⇒ a *retryable typecheck error*, never a
  runtime throw. Keep the read/post split (B2 read vs write) so forks stay least-privilege.
- **Design-system + tokens** are mandatory for every new team-settings/admin UI surface (no raw colors).
- **Testing.** No fix/feature is done until a test would catch a regression (`sdk/org` vitest, run from
  `sdk/org`). Native team surfaces need `pnpm test:native` if `@lmthing/ui` team components change.
- **What we intentionally will *not* copy:** DM-with-agent before B1; unbounded memory; per-user agent
  instances (our shared-per-channel model already matches Claude Tag and is better-grounded).

---

## 5. Suggested sequencing

1. **B1** (THING principal) + **B2** (memory store) — foundations; nothing headline ships cleanly
   without them.
2. **B3** (spend caps) + **B7** (audit) — governance floor; required before ambient can be safe.
3. **B4** (ambient) + **B5** (connectors) — the two features that most visibly close the gap to Claude
   Tag.
4. **B6** (approval gates), then **B8–B12** parity polish.
