# Team mode — caller identity, roles, and channels

A pod normally serves exactly one person, which is why it has no authentication
of its own (see [./README.md](./README.md#auth--gating-conventions)). A **team**
pod is reached by every member of the team, so it has to know who is calling and
what they are allowed to do — and it grows one surface a personal pod does not
have: the channels the team talks in.

Everything on this page is inactive unless the pod is in team mode.

## The switch

Team mode is on when `LMTHING_TEAM_MODE=1`
`sdk/org/libs/cli/src/server/team-guard.ts#isTeamMode`. The gateway sets it as a
**container** env var when it provisions a team's pod
`cloud/gateway/src/lib/compute.ts#teamModeEnv` — deliberately not as a key in the
editable `user-env` secret, because `PUT /api/compute/env` replaces that secret
wholesale and an editor could otherwise drop the key and silently turn the guard
off.

With it unset, `guardRequest` returns `{ok:true}` immediately and the channel
routes are never registered
`sdk/org/libs/cli/src/server/serve.ts:209-217` — a personal pod's API surface is
byte-identical to what it was before teams existed.

## Where identity comes from

The pod does not verify anything itself. Envoy validates the team-scoped JWT and
projects its claims into request headers
(`devops/argocd/envoy/team-policies.yaml`), which the pod reads:

| Header | Claim | Used for |
|---|---|---|
| `x-user-id` | `sub` | who sent a message; who owns a session |
| `x-user-email` | `email` | the display name on a channel message |
| `x-team-id` | `team` | which team this pod belongs to |
| `x-lmthing-role` | `role` | `viewer` or `editor` |

`readCaller(req)` returns these as a `TeamCaller`, or `null` if any of them is
missing or the role is not one of the two known values
`sdk/org/libs/cli/src/server/team-guard.ts#readCaller`. A request that reaches a
team pod without them did not come through the edge, and is refused with **401**
rather than being given a guessed identity
`sdk/org/libs/cli/src/server/team-guard.ts#guardRequest`.

These headers cannot be forged: Envoy's JWT filter overwrites any same-named
header the client sent, and a pod is only reachable through the edge.

## What each role may do

The roles are the ones in `design/teams.md`: a **viewer** uses the team's spaces
and apps, reads the projects and chats with THING; an **editor** does all of that
plus editing projects and spaces and configuring the team.

`guardRequest` runs in the HTTP server before any handler
`sdk/org/libs/cli/src/server/serve.ts:391-401`:

1. `GET`/`HEAD`/`OPTIONS` always pass — a viewer reads everything.
2. An editor passes.
3. A viewer's mutating request must match an explicit allowlist; everything else
   is **403** `sdk/org/libs/cli/src/server/team-guard.ts#VIEWER_ALLOWED`.

Default-deny is the point: a route added later is refused to viewers until
somebody decides otherwise, rather than being silently writable.

A viewer may:

| Route | Why |
|---|---|
| `POST /api/sessions` | chatting with THING is a viewer's right, and a chat needs a session |
| `* /api/sessions/:id/…`, `DELETE /api/sessions/:id` | drive/close **their own** session (below) |
| `POST /api/team/channels/:id/messages` | talk in a channel |
| `POST /api/uploads` | attach a file to a message |
| `POST /api/keepalive`, `POST /api/report-bug` | keep the workspace warm; report a bug |
| `* /app/:projectId/api/…` and the root mount `* /:projectId/api/…` | **use** the team's apps — what an app does internally is its own business, not the team's project source |

A viewer may not write env, restart the pod, create or delete projects, edit
space files or documents, write the filesystem, back up or restore, rebuild an
app or edit its data or source, run a hook, install an app or space, or create a
channel.

### Sessions belong to the member who opened them

`SessionEntry.ownerId` records the caller who created a session
`sdk/org/libs/cli/src/server/session-manager.ts#SessionEntry`, stamped from the
verified identity at create time
`sdk/org/libs/cli/src/server/routes/sessions.ts#handleCreateSession`. A viewer
can only read or drive a session they own
`sdk/org/libs/cli/src/server/routes/sessions.ts#callerMayUseSession`; an editor
is exempt, and so is a session with no recorded owner (one created before this
existed, or on a personal pod where there is only one user).

### WebSockets

`guardWebSocket` applies the same identity rule at upgrade time
`sdk/org/libs/cli/src/server/team-guard.ts#guardWebSocket`. Both roles may open
the agent socket (`/api/ws`) and the channel socket (`/api/team/ws`); a
**terminal** (`/api/terminals/:id`) is editor-only, because it is unrestricted
shell access to the team's workspace.

## Channels

Channels are the Slack-like surface the team talks in. They live on the team's
own pod, next to the projects and spaces THING works on
`sdk/org/libs/cli/src/server/team-channels.ts`.

On disk under `<lmthingRoot>/.team/`:

```
.team/channels.json                  [{ id, name, createdBy, createdAt }]
.team/channels/<channelId>.jsonl     one message per line, append-only
.team/.data/webhook-threads.json     threadRootId → THING's sessionId
```

A dot-directory, so `listProjects` (which only accepts a directory containing
`project.json`) can never mistake it for a project
`sdk/org/libs/cli/src/server/projects.ts#listProjects`. It rides along in GitHub
workspace backups for free, since the backup work-tree is the whole runtime root.

The log is append-only JSONL rather than a database: a channel is a log, reads
are overwhelmingly "the last N", and a line torn by a mid-append kill is dropped
without taking the rest of the history with it
`sdk/org/libs/cli/src/server/team-channels.ts#readMessages`.

### Routes

Registered only in team mode `sdk/org/libs/cli/src/server/serve.ts:209-217`:

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/team/channels` | member | List channels, seeding `#general` on first read `sdk/org/libs/cli/src/server/team-channels.ts#ensureDefaultChannel` |
| POST | `/api/team/channels` | **editor** | Create a channel (`{name}`); the id is the slugified name |
| GET | `/api/team/channels/:channelId/messages` | member | History, newest last; `?limit=` (≤200) and `?before=<messageId>` page backwards |
| POST | `/api/team/channels/:channelId/messages` | member | Post `{text, threadId?}` |

`WS /api/team/ws` is a single per-pod hub: every connected member receives every
channel event and the client filters by the channel it is showing
`sdk/org/libs/cli/src/server/ws/team-channels.ts`. Frames are
`{type:'message'}`, `{type:'thing_status'}` and `{type:'typing'}`.

### Calling THING in a thread

A message that mentions `@thing` gets an answer in the thread it was asked in
`sdk/org/libs/cli/src/server/routes/team-channels.ts#runThingReply`.

The mechanism is the one the inbound-webhook dispatcher already uses: a stable
session id per `(channel, thread)`, resolved through
`getOrCreateThreadSession` `sdk/org/libs/cli/src/server/webhook-threads.ts#getOrCreateThreadSession`
and run with `SessionManager.runHeadlessThreaded`
`sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.runHeadlessThreaded`.
Because the id is stable, every message in a thread **resumes the same
conversation** — which is what "THING remembers the conversation across
messages" means, and why a colleague replying in the same thread is talking to
an agent that already has the context. Two people mentioning THING at once queue
rather than collide, since `runHeadlessThreaded` serializes turns on one session.

The prompt names the sender (`[ana@example.com in #general] …`) so a
multi-person thread reads correctly to the agent — it is one conversation with
several people in it `sdk/org/libs/cli/src/server/team-channels.ts#promptFor`.

`POST …/messages` returns as soon as the member's own message is stored; THING's
answer arrives over the channel socket whenever it is ready, so a slow agent turn
never blocks the composer. The in-flight replies are tracked so a shutdown (or a
test) can wait for them
`sdk/org/libs/cli/src/server/routes/team-channels.ts#settleThingReplies`.

A failed turn is posted into the channel as a `system` message rather than
disappearing.

> **Known limitation.** Headless runs fail closed on consent-gated capabilities,
> so THING-in-a-channel cannot use a connection that would prompt for consent —
> the consent prompter is only wired for interactive sessions
> `sdk/org/libs/core/src/globals/consent.ts`.

## Cross-references

- The team token, roles and membership → [../../cloud/teams.md](../../cloud/teams.md)
- How the edge picks a team's pod and projects the headers → [../../devops/infrastructure.md](../../devops/infrastructure.md)
- Session persistence and `runHeadlessThreaded` → [../../runtime/sessions.md](../../runtime/sessions.md)
