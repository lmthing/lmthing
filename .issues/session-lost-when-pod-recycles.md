# A pod recycle turns the open conversation into `unknown session "<uuid>"`

**Found:** 2026-07-30, seeding a demo workspace on the store-shots account. Reproduced twice within
an hour, both times without touching the app.

## Symptom

The transcript renders an error bubble reading, verbatim:

```
unknown session "b4dc02d1-9e30-4523-a498-4ed53cf4a4c6"
```

Before that, the conversation looks half-dead rather than broken: messages you send appear as your
own bubbles, the budget line even ticks down, and no reply ever arrives.

## What is actually happening

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

Two failures compound here:

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

Higher than it looks. This is the DEFAULT path for anyone who opens the app, reads a conversation,
and comes back after the pod idles out — which on the free tier is the common case, not the edge
case. It also makes the app look broken in exactly the moment a new user is evaluating it.

## Related

- [coldboot-fresh-session-lost-on-heavy-project.md](./coldboot-fresh-session-lost-on-heavy-project.md)
  — a fresh session dying on a heavy project, also a 404 on a session the client believes in.
- [session-resume-machinery.md](./session-resume-machinery.md) — resume defects; the standing rule
  there is "verify via FRESH runs only", which is consistent with resume being unreliable.
