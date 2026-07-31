# A team channel turn runs in `user` and cannot see the project it just built

**Symptom** (scenarios/20-studio run 4 step 6, 2026-07-31): Ana asked to extend the tracker THING had
built for her four steps earlier —

> *"@thing can you add somewhere to log the press checks Cai does? Right now it's in his head."*

After 5 seconds the channel received, verbatim:

```json
{"tables":[],"pages":{"ok":true,"entries":[]},"api":{"ok":true,"entries":[]}}
```

Nothing was added. THING looked, honestly found nothing, and said so — in raw JSON.

## The app exists; the turn is looking somewhere else

Same step's evidence (`runs/4/step-06.json`):

- `activeProject: "fold-studio-job-tracker"` and `state.appTables: {"jobs": 3}` — the app and its
  three rows are real, built in step 2 (`delegates: ["system-viewbuilder"]`, 6 view specs).
- What THING's OWN code saw (`step-06.full.json`, `turns[0].wrote.code`):

```ts
const tables = db.tables();          // → []
const pages  = listProjectDir('pages');  // → { ok: true, entries: [] }
const api    = listProjectDir('api');    // → { ok: true, entries: [] }
```

Two different views of the same pod, because they are two different projects.

## Cause

A channel turn is started with no project at all:

- `libs/cli/src/server/routes/team-channels.ts:1041` — `manager.runHeadlessThreaded({ sessionId,
  agentSlug, message, origin, … })`. There is no `projectId` in the call.
- `libs/cli/src/server/session-manager.ts` — `const projectId = opts.projectId ?? DEFAULT_PROJECT_ID;`
- `libs/cli/src/server/projects.ts:23` — `export const DEFAULT_PROJECT_ID = 'user'`

So **every** team channel turn is bound to `user`. A build still lands in the right place, because
the build target is carried separately (`createProject`/`selectProject` retarget the build and
`SessionManager` persists `buildTargetProjectId`) — but `db.*` and `listProjectDir` in the channel
session read the SESSION's project, which is always `user`. The moment THING builds into a dedicated
project, every later channel turn is blind to it.

## Why it looked fine before

In run 2 THING built into `user` itself (no `createProject`), so later turns could see the tables —
and the app-pinned card even read *"user is ready."* In run 4 it correctly created
`fold-studio-job-tracker`, and that is exactly what broke the follow-ups. **Doing the right thing is
what triggers the bug**, which is why five runs did not surface it cleanly until now.

Same root cause, earlier sightings:

- run 2 step 9 (Rita): the reply `jobs press_checks` was `db.tables()` of `user` — the tables happened
  to be there that run.
- 21-newsroom run 1 step 8: the in-app chat answered *"there are no tables, documents, or stored
  items"* while a `school_closures` table existed — built into `user` while the project was
  `alcal-post-newsroom`.

## What a fix has to decide

The thread needs a project, and it has to be the one the conversation is about. Options, in the
order I would consider them:

1. **Bind the thread to the project it built.** The thread→session map already persists per
   (channel, thread); persist the build target alongside it and pass it as `projectId` on every
   subsequent turn in that thread.
2. **Bind the CHANNEL to a project.** `Channel.apps[]` already records which projects are pinned to a
   channel (`announceNewApps` writes it); a turn in that channel could default to the single pinned
   project.
3. Make `db.*` in a team turn resolve against the build target rather than the session project.

Whichever, the invariant to assert is: *a member asking about the thing THING built for them, in the
channel they asked for it in, reaches that project's data.*

## Evidence

- `sdk/org/scenarios/20-studio/runs/4/step-06.{json,full.json}` — the empty listing and the code
- `sdk/org/scenarios/20-studio/runs/4/step-02.json` — the build that created the project
- `sdk/org/scenarios/20-studio/runs/4/data/.lmthing/fold-studio-job-tracker/` — the app that exists

## Verify a fix

Play 20-studio steps 1–6. At step 6, THING's `db.tables()` must return the tables it built at step 2,
and the press-check store must be added to `fold-studio-job-tracker` — not reported as absent, and
not created a second time in `user`.
