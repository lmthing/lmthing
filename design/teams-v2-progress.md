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
| 1 | GLOBALS · HARNESS · UX-AUDIT (parallel, disjoint paths) | 🔄 running |
| 2 | Team scenarios authored + played · UX fixes from the audit | ⏳ |
| 3 | Fix what the live runs find · re-run to green · docs + push | ⏳ |

## Wave 1 — in flight

| Agent | Lane | Deliverable |
|---|---|---|
| GLOBALS | `libs/core/src/{globals,spaces,typecheck}`, `libs/cli/src/server/team-*` | a `team:*` capability + team-only globals, inert on a personal pod, viewer-safe, DM-safe |
| HARNESS | `scenarios/harness/**` | `TeamPod` (per-member identity headers), a channel-thread THING driver, team-mode `startRun`, and a `team-smoke.mjs` actually run against a live LLM |
| UX-AUDIT | read-only | `design/teams-ux-audit.md` — ranked, every finding cited `path:line`, with the THING-in-channel vs `/chat` gap list and a 390px/320px pass |

## Planned scenarios (Wave 2)

Team scenarios need verbs the personal runner has no concept of — *who* speaks, *which* channel,
*in a thread or not*, and a member who is only a viewer. They will be played by a team runner built
on the Wave-1 harness rather than by bending `run-scenario.mjs`, so the eight existing scenarios
keep behaving byte-identically.

| # | Scenario | The promise it proves |
|---|---|---|
| 20-studio | a four-person design studio, one channel per client | THING builds an app from a channel conversation, then **several different people update it** from different threads — and the thread, not the person, owns the memory |
| 21-clinic | a three-person physio clinic running a rota | THING reached by **DM**, a scheduled turn that posts back **into a channel**, and the team-only globals doing work no personal pod can do |
| 22-first-hour | a brand-new team's first hour | the first-run experience: an empty `#general`, the first app, invites, categories, unread — the beats that decide whether the product feels finished |

App building in these scenarios routes to **`system-viewbuilder`** (explicit opt-in per the
app-builder-v2 owner decision), so the apps render natively on the phone.

## Standing constraints

- **Everything local.** Per-run isolated `lmthing serve`, own port and data dir. Never prod.
- **A concurrent session shares this worktree.** Commit with `git commit --only <paths>`; never
  `git add -A`. Off-limits to this lane: `libs/cli/src/app/view-spec/**`,
  `libs/core/system-spaces/system-viewbuilder/**`, `libs/ui/src/view/**`, root `PROGRESS.md`,
  `design/appbuilder-viewspec-plan.md`.
- **`libs/cli/src/server/team-channels.ts` contains a raw NUL byte** — `grep` silently skips the
  whole file. Read it with python.
- Docs move in the same change as the code; `pnpm docs:check` and `pnpm lint:tokens` are hard gates.
