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
| `PUT /api/team/profile` | choose their own handle — not configuring the team, and a viewer nobody can address cannot be talked to |
| `POST /api/team/dms` | open a direct message, which grants nothing beyond itself |
| `POST /api/uploads` | attach a file to a message |
| `POST /api/keepalive`, `POST /api/report-bug` | keep the workspace warm; report a bug |
| `* /app/:projectId/api/…` and the root mount `* /:projectId/api/…` | **use** the team's apps — what an app does internally is its own business, not the team's project source |

A viewer may not write env, restart the pod, create or delete projects, edit
space files or documents, write the filesystem, back up or restore, rebuild an
app or edit its data or source, run a hook, install an app or space, create or
rename a channel, file one under a category, manage categories, or pin an app to
a channel.

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
.team/channels.json                  [{ id, name, createdBy, createdAt, kind?, members?, categoryId?, apps? }]
.team/categories.json                [{ id, name, order }]
.team/members.json                   [{ userId, email?, handle?, displayName?, joinedAt, updatedAt }]
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
| GET | `/api/team/channels` | member | List the channels this caller can see, **plus** the categories, in one response `sdk/org/libs/cli/src/server/routes/team-channels.ts#handleListChannels` |
| POST | `/api/team/channels` | **editor** | Create a channel (`{name, categoryId?}`); the id is the slugified name |
| PATCH | `/api/team/channels/:channelId` | **editor** | Rename it, file it under a category, or set the apps pinned to it (`{name?, categoryId?, apps?}`) `sdk/org/libs/cli/src/server/team-channels.ts#patchChannel` |
| GET | `/api/team/channels/:channelId/messages` | member | History, newest last; `?limit=` (≤200) and `?before=<messageId>` page backwards |
| POST | `/api/team/channels/:channelId/messages` | member | Post `{text, threadId?}`; **404** if the channel does not exist or is not visible to the caller `sdk/org/libs/cli/src/server/routes/team-channels.ts#handlePostMessage` |
| POST | `/api/team/dms` | member | Open (or reopen) the direct conversation with `{userId}` |
| GET/POST | `/api/team/categories` | member / **editor** | List, or create `{name}` |
| PATCH/DELETE | `/api/team/categories/:categoryId` | **editor** | Rename or reorder `{name?, order?}`; delete |
| GET | `/api/team/directory` | member | The `@`-picker's data: members (with handles) and projects (with `hasApp`) |
| GET/PUT | `/api/team/profile` | member | Read, or set `{handle?, displayName?}` — **409** when a handle is taken or reserved |

A fresh team is seeded with `#general` `sdk/org/libs/cli/src/server/team-channels.ts#ensureDefaultChannel`. The trigger is the channels file not existing yet, and **every** entry point above seeds before it acts — listing, creating, and posting. Keying it off an empty list instead let whichever route ran first decide: creating a channel before anyone listed wrote the file without `#general`, and the team never got one. Because the trigger is file absence, a team that deliberately removes every channel stays empty rather than having `#general` reappear underneath it.

`WS /api/team/ws` is a per-pod hub `sdk/org/libs/cli/src/server/ws/team-channels.ts`.
Server frames are `{type:'message'}`, `{type:'thing_status'}`, `{type:'typing'}`,
`{type:'channel'}`, `{type:'categories'}` and `{type:'app_created'}`. A named
channel's events go to every connected member and the client filters by the
channel it is showing; a **DM's** events are restricted to its participants'
sockets by an explicit audience
`sdk/org/libs/cli/src/server/ws/team-channels.ts#audienceFor`, because "the
client filters" is not a boundary.

The one frame a CLIENT may send is `{type:'typing', channelId}`. The server
stamps the identity the upgrade was verified with and rebroadcasts to everybody
else `sdk/org/libs/cli/src/server/ws/team-channels.ts#registerChannelSocket` — a
client-supplied `userId` would let any member forge "so-and-so is typing" for
anyone. Typing is socket-only and never written to the log: it is stale within
seconds and nobody can page back through it.

### The directory, and handles

`.team/members.json` is the writable name layer over the identity Envoy projects
`sdk/org/libs/cli/src/server/team-members.ts`. A member picks a **handle** (the
`@`-typeable name, unique within the team, case-insensitively) and optionally a
display name. The roster fills itself: every identified read of the directory or
profile, and every posted message, upserts the caller
`sdk/org/libs/cli/src/server/team-members.ts#touchMember`, so a member is
addressable from the moment they first open the surface.

`@thing` is reserved, along with the broadcast words (`here`, `channel`,
`everyone`, `all`) `sdk/org/libs/cli/src/server/team-members.ts#RESERVED_HANDLES` —
a member holding `@thing` would silently turn every mention of themselves into a
call to the agent.

A posted message records the ids of the members it named, resolved **at write
time** `sdk/org/libs/cli/src/server/team-members.ts#resolveMentions`: a handle
can be given up and re-claimed, and a message must keep naming the person it
named rather than whoever holds the handle today.

The gateway's `team_members` table remains the authority on who is a member and
with what role (see [../../cloud/teams.md](../../cloud/teams.md)); nothing here
grants access to anything.

### Direct messages

A DM is a channel — same record, same log file, same socket — distinguished only
by `kind:'dm'` and the `members` it is visible to. Separate storage would have
duplicated history paging, THING threading and the fan-out socket for no
behavioural difference; what genuinely differs is who may see it, and that is one
predicate `sdk/org/libs/cli/src/server/team-channels.ts#isVisibleTo` rather than a
second implementation.

The id is derived from the sorted participant ids
`sdk/org/libs/cli/src/server/team-channels.ts#dmChannelId`, so two people opening
a DM from opposite ends land in the SAME conversation instead of each creating
half of it.

A DM the caller is not in answers **404**, not 403
`sdk/org/libs/cli/src/server/routes/team-channels.ts#requireVisibleChannel`: "you
may not read this" and "this does not exist" are the same fact to someone who
should not know it exists, and a 403 confirms that two named people have a
conversation.

### Apps beside a channel

A channel records the project ids whose app is pinned to it (`Channel.apps`), so
an app can be opened next to the conversation that produced it. When THING
finishes a turn that produced an app, the pod does three things
`sdk/org/libs/cli/src/server/routes/team-channels.ts#announceNewApps`:

1. **pins** it to the channel, which is what makes it available tomorrow as well
   as today;
2. appends a `system` message carrying `app: {projectId, name}` — a card in the
   thread, in the log, so scrolling back through the conversation still shows
   what it produced and offers to open it;
3. broadcasts `{type:'app_created', …, requestedBy}` so the member who **asked**
   can have it open beside them without touching anything. Only the asker: for
   everyone else the tab and the card are an offer, and throwing a pane open over
   somebody who did not ask is an interruption, not a notification.

"Has an app" here means the project has a `pages/` directory — what gets pinned
is something a member can look at, and an app with no pages has no URL to put
beside the conversation.

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
