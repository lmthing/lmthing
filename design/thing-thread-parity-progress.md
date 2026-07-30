# THING threads in teams → parity with THING chat

Started 2026-07-30. (Root `PROGRESS.md` is held by the app-builder-v2 work, so this
lives here — same convention as `design/teams-mobile-progress.md`.)

Goal, from the owner: a team thread should behave like `/chat`. Chosen scope:
**answerable `ask()`, held indefinitely** + **live activity**. Full live-session
parity (streaming statements, consent prompts) explicitly out of scope for now.

## Why

`runHeadlessThreaded` builds a fresh `WebRenderHost` with **zero clients**, but a
top-level session grants `ask` (only delegates set `omitAsk`). So THING is told it
has `ask()` in a channel, and using it emits `ask_start` to nobody and returns a
promise that never resolves — the turn hangs holding that thread's `runExclusive`
lock, and every later message queues behind it.

That is the same root cause as "it showed the code lines and stopped": THING is
offered an interaction the channel cannot service, so it either avoids it and
finishes having done nothing, or uses it and wedges the thread.

Risk accepted by the owner after being flagged: an ask waits forever. Mitigated in
practice because a reply in a THING thread now addresses THING, so **any** reply
resolves it — a thread self-heals on the next message. An abandoned thread holds
one suspended session until the pod restarts.

## Steps

- [x] S1 `WebRenderHost` gains an `onEvent` seam so a non-WS caller can observe
      `ask_start`/`ask_end`. (`ask`/`submitForm` is already a transport-agnostic
      suspend/resume pair — it just had no listener.)
- [x] S2 `runHeadlessThreaded` accepts an injected `renderHost` + an `onActivity`
      hook (the tracer already writes `activity` for every `setActivity()`).
- [x] S3 team-channels: per-thread pending-ask registry. `ask_start` → post the
      descriptor into the thread as a `thing` message (stored as `blocks`, which
      is how a channel already renders components); record `{renderHost, askId}`.
- [x] S4 team-channels: a message in a thread with a pending ask RESOLVES it
      (`submitForm`) instead of starting a second turn.
- [x] S5 `thing_status` carries an `activity` label; the thread shows it while
      THING works.
- [x] S6 Tests: ask posts and resolves; a reply answers rather than re-runs; a
      thread with no pending ask still runs normally; activity reaches the socket.
- [x] S7 Docs — `cli-api/rest/team.md`.

## Gates

`pnpm typecheck` · `pnpm test libs/cli/src/server` · `pnpm test:native` ·
`npm run docs:check` · `pnpm lint:tokens`

Known-flaky under full-suite parallel load, pass in isolation, not caused by this
work: `session-manager.spaceref.test.ts`, `team-social.test.ts`.

## Status

S1–S7 done. Gates green (529 server tests; `team-social` flaky under parallel load
only, passes isolated). Not yet exercised against a real pod.

One thing the work itself surfaced: a parked turn must NOT be tracked as in-flight
work. `settleChannelWork` is the graceful-shutdown drain, so an unanswered ask
would have hung pod shutdown forever — caught because the test suite hung on
exactly that. `beginThingReply` now reports a turn as settled-for-draining the
moment it parks; the run continues untracked and posts when answered.
