# THING can create a channel now — the LIVE half is not verified

**Status 2026-07-31: the capability gap is CLOSED and unit-tested; the behaviour is not
live-verified.** Keep this file until a live run shows THING both reaching for the verb and
describing what it made in plain words.

## What was wrong (fixed)

`TeamResolver` had six verbs, all read-or-post, so 21-newsroom run 1 step 4 ("give this
somewhere of its own so it stops clogging up the desk") was **not satisfiable by any correct
behaviour**: THING built a space and an app instead and described them to a non-technical
colleague as *"its own space"*, *"specialist space"*, *"the … project"*.

## What shipped

- `teamCreateChannel(name, { categoryId? }) → { ok, channelId, name, created }`, gated on
  **`team:post`** (not a third id — same authority as speaking in a channel), editor-only,
  get-or-create on the slugified name, announced to connected members through the route's
  existing `onChannelChanged` broadcast. One creation path: it calls the same
  `team-channels.ts#createChannel` the REST route calls.
  `sdk/org/libs/core/src/globals/team.ts` · `sdk/org/libs/cli/src/server/team-globals.ts`.
- THING's instruct gained two rules in the team section: finish the job (say it exists, put the
  first message in it, `@`-mention the people it belongs to), and **never describe what it made
  in product vocabulary** — no "space", "project", "specialist", "workflow", "session".
- Docs: `org/docs/runtime-globals/team.md` §1, §4, §5, §7.

## Still to verify (live)

Replay 21-newsroom step 4 through the lmauto judge campaign — NOT a manual run-yaml replay:

1. `GET /api/team/channels` gains a channel named for the subject.
2. The turn's `wrote.globals` contains `teamCreateChannel` (and `teamMembers`, since the
   people on the subject have to be named rather than guessed).
3. The reply contains none of "space" / "project" / "specialist", and the members named in it
   are the ones the directory says are on the subject.

If (3) still fails with the verb present, the residual is a reasoning/prose failure and belongs
in a fresh issue about the reply, not about the surface.
