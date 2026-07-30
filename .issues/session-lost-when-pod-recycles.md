# The compute pod is OOMKilled mid-turn, and the reply never arrives

**Found:** 2026-07-30, seeding a demo workspace on the store-shots account. Reproduced twice within
an hour, both times without touching the app.

## Symptom

The transcript renders an error bubble reading, verbatim:

```
unknown session "b4dc02d1-9e30-4523-a498-4ed53cf4a4c6"
```

Before that, the conversation looks half-dead rather than broken: messages you send appear as your
own bubbles, the budget line even ticks down, and no reply ever arrives.

## Root cause: OOMKilled at 512Mi

```
lastState.terminated:
  reason:     OOMKilled
  exitCode:   137
  finishedAt: 2026-07-30T16:36:03Z
resources.limits: {cpu: 1500m, memory: 512Mi}
```

The container is killed by the kernel **during a THING turn**. Everything below follows from that:
the in-memory session dies with the container, the client keeps posting to an id nothing holds, and
the user sees a UUID in an error bubble — or, worse, sees nothing at all and a budget that ticks
down while no reply ever comes.

Observed live: a FRESH session, one research-flavoured question ("What should we not miss in
Kanazawa"), daily budget falling 32% → 20% as tokens were genuinely spent, and no assistant message
ever rendered. `GET /api/sessions/<id>/state` answered `unknown session` while the turn was
supposedly running. Container `RESTARTS: 1`.

512Mi is the FREE-TIER limit, so this is the default experience, not an edge case. The pod also runs
a `[mem-watchdog] (cgroup v2 memory pressure eviction)` of its own, which suggests memory pressure
was a known hazard here before this.

## What is actually happening once the container dies

Sessions are held **in memory** by the pod's session manager. A compute pod is scale-to-zero and is
recreated on demand, and the client keeps using the `sessionId` it already has:

| | |
|---|---|
| pod at first probe | `lmthing-65c595db8f-m9tn6` |
| pod when the error appeared | `lmthing-8445fd8dc4-p6xvm`, started 16:01:31Z, restartCount 0 |
| `GET /api/sessions` (loaded) | one session, not the one the client held |
| `GET /api/projects/japan-trip/sessions` (persisted) | `b4dc02d1…` present, 1 msg |

So the session **was never lost** — it is on disk, with its history. It is simply not loaded, and
every `POST /api/sessions/:id/message` against it takes the `!entry` branch in
`handleSessionSubRoute` (`sdk/org/libs/cli/src/server/routes/sessions.ts`), which answers
`404 {error: 'unknown session "<id>"'}`. The client surfaces that string in the transcript.

Three failures compound here:

0. **The turn is lost with no signal.** The user spent budget and got nothing back. Whatever else
   changes, a killed turn must be recoverable or at minimum reported as failed.


1. **Nothing rehydrates a persisted session on demand.** The obvious fix — when a sub-route names a
   session the manager does not hold but which exists on disk, load it and continue — would make the
   whole class disappear.
2. **The raw error is shown to the user.** A UUID in an error bubble is not a message to a person.
   Even without (1), this should be "reconnecting…" and a retry.

## Also observed, possibly the same root

**Resumed conversations render only the USER's messages.** Opening a persisted conversation shows
your own turns and none of the agent's replies, so an old thread looks like a monologue. Not yet
traced; it may be the same missing-rehydration path (the transcript replays from what the manager
holds), or a separate gap in what history restore feeds the render host.

## Impact

This is the default free-tier experience for a non-trivial question, not an edge case. The user is
charged for tokens (the budget line moves) and receives no answer. It also blocked the Play Store
screenshot work, which is how it was found: three separate attempts to capture a normal
question-and-answer produced a transcript with the user's message and nothing else.

## Next

Confirm whether 512Mi is simply too small for a THING turn (raise the free-tier limit and re-measure)
or whether something in the turn leaks — the `mem-watchdog` presence suggests the latter was already
suspected. Either way the client must not present a killed turn as silence.

## Related

- [coldboot-fresh-session-lost-on-heavy-project.md](./coldboot-fresh-session-lost-on-heavy-project.md)
  — a fresh session dying on a heavy project, also a 404 on a session the client believes in.
- [session-resume-machinery.md](./session-resume-machinery.md) — resume defects; the standing rule
  there is "verify via FRESH runs only", which is consistent with resume being unreliable.
