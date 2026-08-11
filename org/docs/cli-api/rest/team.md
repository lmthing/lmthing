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

**The client reconnects the channel socket itself, with a capped exponential
backoff** `sdk/org/libs/ui/src/team/use-team-chat.ts#useTeamChat` — a 500ms
initial retry, doubling up to an 8s ceiling, reset to 500ms on a successful
`open`. Without it, any network blip, laptop sleep or pod restart left
`onmessage` wired to a socket that would never reopen, so messages, typing and
`thing_status` went silently dead until a full page reload. `TeamChat.connection`
distinguishes the first `connecting` from a later `reconnecting` (the socket
*was* live and dropped), which is what lets the view show "Reconnecting…" only
for the case actually worth telling a member about
`sdk/org/libs/ui/src/team/channels-view.tsx#TeamChannelsView`. The mobile shell
keeps the team screen mounted-but-hidden across tab switches specifically so
this one socket survives them, which only pays off because it can heal itself.

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

### Ordering, and a send that arrives twice

**`seq` is the ordering key** `sdk/org/libs/cli/src/server/team-channels.ts#ChannelMessage`
— a per-channel position, 0 for the first message ever posted there. `ts` is not
one: it is a wall-clock ISO string, two messages written in the same millisecond
tie with nothing to break them, and a clock adjustment can move it backwards.

Every append on a channel takes that channel's lock and mints the next position
under it `sdk/org/libs/cli/src/server/team-channels.ts#appendMessageOnce`, so
file order, `seq` order and `ts` order all agree — appends used to be
unserialized `appendFile` calls, so they could interleave and leave the file
disagreeing with the timestamps in it, with nothing to reconcile them. `ts` is
also clamped so it never runs backwards within a channel.

Reads then sort `sdk/org/libs/cli/src/server/team-channels.ts#readMessages`.
Rows written before positions existed have no `seq`, so the sort falls back to
`ts` and then to file order — a log that predates this keeps exactly the order it
has always had, and numbering continues from the end of it rather than restarting
at 0.

**`clientId` makes a send idempotent.** A composer that posts, times out and
retries used to store the message twice, because the id was minted server-side
per call and nothing could tell a retry from a second send. A repeat of a
`clientId` this channel has already seen returns **200** with the row the first
attempt stored and `deduplicated:true`, and — just as importantly — does not
broadcast, badge or push it again. The window is bounded and lives in the pod
(`DEDUPE_WINDOW`, 500 sends per channel): a retry follows its timeout by seconds,
so it only has to outlive a request.

### Routes

Registered only in team mode `sdk/org/libs/cli/src/server/serve.ts:209-217`:

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/team/channels` | member | List the channels this caller can see, **plus** the categories, in one response `sdk/org/libs/cli/src/server/routes/team-channels.ts#handleListChannels` |
| POST | `/api/team/channels` | **editor** | Create a channel (`{name, categoryId?}`); the id is the slugified name |
| PATCH | `/api/team/channels/:channelId` | **editor** | Rename it, file it under a category, set the apps pinned to it, or set who may invoke THING (`{name?, categoryId?, apps?, thingAccess?}`, `thingAccess: 'all' \| 'editors'`) `sdk/org/libs/cli/src/server/team-channels.ts#patchChannel` |
| GET | `/api/team/channels/:channelId/messages` | member | History, newest last; `?limit=` (≤200) and `?before=<messageId>` page backwards. Also returns `turns` — the THING turns running in this channel right now (below) |
| POST | `/api/team/channels/:channelId/messages` | member | Post `{text, threadId?, clientId?, answersAskId?, attachmentIds?}`; **404** if the channel does not exist or is not visible to the caller `sdk/org/libs/cli/src/server/routes/team-channels.ts#handlePostMessage`. **200** (not 201) with `deduplicated:true` when `clientId` repeats a send; **409** when `answersAskId` names a question the thread is not waiting on; **403** when an `attachmentIds` entry is an upload the caller does not own (below) |
| POST | `/api/team/channels/:channelId/read` | member | Mark read, optionally `{messageId}` to say how far `sdk/org/libs/cli/src/server/routes/team-channels.ts#handleMarkRead` |
| POST | `/api/team/dms` | member | Open (or reopen) the direct conversation with `{userId}` |
| GET/POST | `/api/team/categories` | member / **editor** | List, or create `{name}` |
| PATCH/DELETE | `/api/team/categories/:categoryId` | **editor** | Rename or reorder `{name?, order?}`; delete |
| GET | `/api/team/directory` | member | The `@`-picker's data: members (with handles) and projects (with `hasApp`) |
| GET/PUT | `/api/team/profile` | member | Read, or set `{handle?, displayName?}` — **409** when a handle is taken or reserved |

The `?limit=`/`?before=` cursor on `GET …/messages` is not just a server capability — the shared UI
consumes it. `TeamClient.messages` (`sdk/org/libs/ui/src/team/client.ts#TeamClient`) takes an
optional `{limit?, before?}`, `useTeamChat` surfaces the response's `hasMore` and a `loadOlder()`
that pages backwards from the oldest message currently loaded, and the team surface offers a "Load
earlier messages" affordance at the top of the transcript once there is more to fetch
(`sdk/org/libs/ui/src/team/channels-view.tsx#LoadEarlierButton`) — round-2 detail (DM ordering,
Escape-to-dismiss, copy) is at [`mobile/README.md#round-2`](../../mobile/README.md#round-2--older-history-dm-ordering-escape-to-dismiss-copy).

A fresh team is seeded with `#general` `sdk/org/libs/cli/src/server/team-channels.ts#ensureDefaultChannel`. The trigger is the channels file not existing yet, and **every** entry point above seeds before it acts — listing, creating, and posting. Keying it off an empty list instead let whichever route ran first decide: creating a channel before anyone listed wrote the file without `#general`, and the team never got one. Because the trigger is file absence, a team that deliberately removes every channel stays empty rather than having `#general` reappear underneath it.

`WS /api/team/ws` is a per-pod hub `sdk/org/libs/cli/src/server/ws/team-channels.ts`.
Server frames are `{type:'message'}`, `{type:'thing_status'}`, `{type:'typing'}`,
`{type:'channel'}`, `{type:'categories'}` and `{type:'app_created'}`
`sdk/org/libs/cli/src/server/ws/team-channels.ts#ChannelEvent`. A named
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

**Inside a thread THING is already in, every reply reaches it — no second
`@thing`** `sdk/org/libs/cli/src/server/routes/team-channels.ts#addressesThing`.
Re-addressing an agent in a thread it is a participant of is not how a
conversation works, and the effect of requiring it was worse than clumsy: a
natural follow-up went nowhere at all, so the thread looked dead.

"Already in" is decided by whether the thread has a session, not by scanning the
channel log for a `thing` message
`sdk/org/libs/cli/src/server/webhook-threads.ts#getThreadSession`. An entry
exists exactly when THING has run in that thread, which is O(1) and cannot be
defeated by a busy channel pushing the thread's root out of any window a scan
would read. The lookup is deliberately read-only — the question is asked *before*
deciding to run, so minting an id there would record a conversation that never
happened and make the next message believe one had.

Two scopes are deliberately unchanged: a **channel-level** post still needs the
mention (a channel where every message invoked an agent is unusable), and a
thread THING has never answered in stays between the humans. Threads are what
makes implicit addressing safe — you opt in by opening one with THING. The
thread composer stops advertising `@thing` once THING has answered there
`sdk/org/libs/ui/src/team/channels-view.tsx#TeamChannelsView`.

### Access mode — who may invoke THING in a channel

A channel carries an optional `thingAccess`
`sdk/org/libs/cli/src/server/team-channels.ts#Channel`. Absent (the default, and
how every channel written before access modes reads) means `'all'` — any member
can invoke THING. `'editors'` restricts **invocation** to editors: a viewer's
`@thing` in such a channel is declined with a `system` notice ("Only editors can
ask THING in this channel.") and no turn runs, while the viewer's own message
still stands. The decision is the pure
`sdk/org/libs/cli/src/server/team-guard.ts#canInvokeThing`, enforced at the post
edge `sdk/org/libs/cli/src/server/routes/team-channels.ts#postThingAccessDenied`.

This gates invocation only — it is **not** a read/write permission. A viewer keeps
every channel right they had (`VIEWER_ALLOWED`): reading, posting, opening a DM. It
is set by an editor through the channel PATCH route above (`{thingAccess}`).

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

That prose prefix is **not** how the turn knows who is asking. The verified
`TeamCaller` read from the request's Envoy headers is passed as a value down
`handlePostMessage` → `beginThingReply` → `runThingReply`
`sdk/org/libs/cli/src/server/routes/team-channels.ts#runThingReply`, which builds
a per-turn team resolver bound to it
`sdk/org/libs/cli/src/server/team-globals.ts#createTeamResolver` and hands it to
`runHeadlessThreaded({ team })`. That resolver is what backs THING's `team:read` /
`team:post` globals — the directory, the channel list, channel history, posting
into another channel, pinning an app, creating a channel — and every one of them answers for **that
member**: a DM they are not in is invisible, and a viewer cannot write. A turn
with no verified caller gets no team globals at all. The full surface, the
capability split and the refusals → [runtime-globals/team.md](../../runtime-globals/team.md).

A channel id mentioned in a prompt is not authorisation: reads go through the same
`isVisibleTo` predicate `requireVisibleChannel` uses for a direct HTTP read
`sdk/org/libs/cli/src/server/team-channels.ts#isVisibleTo`.

`POST …/messages` returns as soon as the member's own message is stored; THING's
answer arrives over the channel socket whenever it is ready, so a slow agent turn
never blocks the composer.

The client appends that REST response to the transcript immediately, rather than
waiting for the same message to arrive back over the channel socket
`sdk/org/libs/ui/src/team/use-team-chat.ts#useTeamChat` — on a slow or dropped
connection the socket echo might be delayed or lost outright, and the sender
would never see their own message land. The later echo (if it comes) is deduped
against the REST response by message id, so it never appears twice. A failed
`postMessage` is surfaced through the same `error` state every other mutation in
the hook uses, and rethrown so the composer restores the drafted text instead of
silently losing it.

That leaves real work in flight that nothing is awaiting — THING's answer, and the
delivery bookkeeping below — so it is all tracked in one place and drainable
`sdk/org/libs/cli/src/server/routes/team-channels.ts#settleChannelWork`, for a
shutdown that would rather not drop a half-finished answer and for a test that
needs to know it has landed.

A failed turn is posted into the channel as a `system` message rather than
disappearing.

### Attachments

`POST …/messages` accepts `attachmentIds?: string[]` naming uploads made
earlier via `POST /api/uploads` ([`./uploads.md`](./uploads.md)) —
`resolveMessageAttachments`
`sdk/org/libs/cli/src/server/routes/team-channels.ts#resolveMessageAttachments`.
The stored row carries a `ChannelAttachment[]`
`sdk/org/libs/cli/src/server/team-channels.ts#ChannelAttachment` — `{id, kind,
mediaType, filename?, url, transcript?}`, thin on purpose: enough for a client
to render a thumbnail, a link, or (for audio) the caption `/chat` already
shows under a clip, with the rest of `UploadMeta`'s extraction bookkeeping
(`text`/`pages`) staying server-side. This is also the socket frame's shape
(`{type:'message'}` carries the whole `ChannelMessage`), so a live client sees
an attachment the moment it is posted, not only on reload.

**The poster must own every id they name**, or the whole post is refused with
**403** `{error, attachmentIds}` naming the offending id(s) — checked against
`UploadMeta.ownerUserId` via `SessionManager.readUploadMeta`
`sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.readUploadMeta`.
Without this a member could name someone ELSE's upload id in their own message
and thereby publish it to the whole channel audience — the exact hole
`GET /api/uploads/:id`'s owner check exists to close ([`./uploads.md`](./uploads.md#get-apiuploadsid)),
reopened by a second door. An ownerless upload (one stored before the owner
field existed) is allowed through unchanged, matching the serve route's own
decision — it is already readable by any member.

**Posting is what grants the audience read access.** Before the message is
appended (and therefore before it is broadcast), the pod records this channel
on each attachment — `recordUploadChannel`
`sdk/org/libs/cli/src/server/uploads.ts#recordUploadChannel`, via
`SessionManager.bindUploadToChannel`. `GET /api/uploads/:id` then serves a
non-owner caller who is in the audience of ANY channel the upload has been
bound to, using the same `isVisibleTo` predicate a message read uses — so a
DM's attachment stays visible only to its two members, exactly like the
message it was posted with.

**THING sees them too.** The message that mentioned THING (or replied in a
thread THING is already in) has its `attachments` routed into the turn through
`SessionManager.assembleAttachments`
`sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.assembleAttachments`
— the identical assembly `/chat`'s `sendMessage` already uses, not a second
mechanism ([`./uploads.md#how-an-attachment-reaches-the-agent`](./uploads.md#how-an-attachment-reaches-the-agent)).
`runHeadlessThreaded`'s `message` therefore carries `UserInput` (text, or
`{text, attachments}`) rather than a bare string
`sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.runHeadlessThreaded` —
images become a model-facing part, files an id THING delegates by, and audio's
transcript folds into the text, same as chat.

### `ask()` in a thread — the question is a message, the reply is the answer

In `/chat` a client renders an `ask()` form and posts the value back. A channel
has no such client, and a top-level session grants `ask` regardless (only
delegates set `omitAsk`), so THING was being offered an interaction the channel
could not service: `ask()` emitted `ask_start` to a `WebRenderHost` with **zero
clients** and returned a promise nothing could settle, hanging the turn and
holding that thread's `runExclusive` lock against every later message.

Now the run is built on a host the channel owns
`sdk/org/libs/cli/src/rpc/server.ts#WebRenderHost.onEvent`. An `ask_start` posts
the descriptor into the thread as a `thing` message (stored as `blocks`, the same
way a JSX answer is), and the next message in that thread **resolves** the ask
instead of starting a second turn
`sdk/org/libs/cli/src/server/routes/team-channels.ts#answerPendingAsk`. The value
is the raw text: a channel reply is prose, and that is what a person would say.

**The question says it is one.** The row carries `ask: {id, expiresAt}`
`sdk/org/libs/cli/src/server/team-channels.ts#ChannelMessage`, and parking
broadcasts `{type:'thing_status', status:'waiting', askId}`
`sdk/org/libs/cli/src/server/routes/team-channels.ts#runThingReply`. Neither
existed: the question was stored as an ordinary `thing` reply and the last frame
a client had seen said `running`, so no client could tell a question from an
answer *even in principle*, and the busy indicator went on saying THING was
working while it was in fact blocked on a person. Answering broadcasts `running`
again, so a thread a client dimmed does not stay dimmed for the rest of the turn.

**Who answered it, and with what, is in the log.** A reply that resolves an ask
is stamped `answersAsk: <askId>`. A client that *knew* it was answering says
`answersAskId` in its POST; one that did not — any reply in the thread, which is
the fallback that lets a client knowing nothing about asks answer one at all —
gets a `system` receipt appended before the agent is unblocked, naming the member
and quoting what was submitted
`sdk/org/libs/cli/src/server/routes/team-channels.ts#answerPendingAsk`. Without
it the fallback is spooky rather than helpful: two people are in a thread, one
types "brb", and those words go to the agent with nothing anywhere admitting it.
A POST whose `answersAskId` is **not** the question the thread is waiting on
answers **409** and stores nothing — a client with a stale picture must re-read,
not have its words submitted to whichever question happens to be open now.

The turn is held **indefinitely** — the owner's decision, taken over a flagged
objection that an unanswered ask pins a session. In practice a thread heals
itself, because every reply in a THING thread addresses THING, so the first thing
anybody says resolves it.

What is bounded is the **question**, not the turn. An open ask holds the thread's
session lock, so every later message in that thread queues behind it: a thread
that is not merely stuck but silently stuck. After one hour
(`LMTHING_TEAM_ASK_TIMEOUT_MS` overrides it) the pod stops waiting — it appends a
`system` row saying so, resolves the ask with prose telling the agent nobody
answered, and the run **resumes and finishes normally**
`sdk/org/libs/cli/src/server/routes/team-channels.ts#runThingReply`. Nothing is
cancelled: an agent that receives a value can decide for itself whether to
proceed or to stop and say what it still needs, where throwing into the turn
would have turned "nobody was around" into a crash report.

> A parked turn is deliberately **not** counted as work in flight
> `sdk/org/libs/cli/src/server/routes/team-channels.ts#beginThingReply`. It is
> waiting on a human and may wait forever, so leaving it in `inFlight` made
> `settleChannelWork` never return — one unanswered question would have hung the
> pod's graceful shutdown. It is put **back** in flight the moment the question is
> answered: only the waiting is untrackable, and the rest of the turn (its answer,
> its app card, its badges) is work a shutdown should still wait for.

### Live activity

`thing_status` carries an `activity` label while a turn runs, fed from the
tracer's `activity` events (every `setActivity()` the agent makes)
`sdk/org/libs/cli/src/server/routes/team-channels.ts#runThingReply`. A build runs
for minutes; with nothing on screen a reader cannot tell it apart from a hang.
The thread shows it beside THING's name and clears it on `done`/`error`.

Where it shows is load-bearing: **pinned above the thread composer, outside the
scrolling transcript**
`sdk/org/libs/ui/src/team/channels-view.tsx#ThreadRail` — the same place the
channel puts its own `TypingStrip`, and for the same reason. As the last child of
the `Scroll` it was off screen for a reader who had scrolled up to reread the
question, which on a long thread is exactly when a minutes-long build is the only
thing happening. A turn in flight is live state, not transcript.

It is also its own sentence rather than a name with a step folded into it
`sdk/org/libs/ui/src/team/messages.tsx#AgentActivityStrip`: reusing the typing
strip rendered "THING — Building the pages is typing…", the one place the label
is not a person and the one verb that is wrong for it.

Every `running`/`waiting` frame also carries **`startedAt`**, so elapsed time is
renderable at all — without it a client can only time a turn from whichever frame
it happened to receive.

And the live state is **readable, not only broadcast**: `GET …/messages` returns
a `turns` array of the THING turns running in that channel — `{channelId,
threadId, status, startedAt, activity?, askId?}`
`sdk/org/libs/cli/src/server/routes/team-channels.ts#ThingTurn`. A frame is sent
once and then forgotten, so a member who opened the channel one minute into a
seventeen-minute build received none of them and saw a thread that looked
finished and empty — which for a long build is the common case, not an edge one.

It is in memory rather than on a message row on purpose: a turn in flight is a
property of *this process*, and a "running" turn recovered from disk after a
crash would be a lie. Turning it into a placeholder row that gets patched as the
turn proceeds needs a message-update frame the socket does not have — see the
protocol gaps in `design/teams-ux-audit.md` (B1).

The client also holds a **client-side safety timeout** on top of that terminal
frame `sdk/org/libs/ui/src/team/use-team-chat.ts#useTeamChat` (90s, reset on
every `running` frame). The server only clears `thinking`/`activity` by sending
that explicit terminal frame; if the pod dies mid-turn it never gets to send one,
and without the timeout "THING is working…" would stay on screen for the rest of
the session.

### The reply is what the agent DISPLAYED — never what it wrote

`runHeadless` returns `result` from the turn's `display()` calls and nothing else
`sdk/org/libs/cli/src/server/session-manager.ts#SessionManager`. There is
deliberately no fallback to the last history entry, because **in this runtime the
model does not answer in prose — it writes TypeScript**, so that entry is the
turn's source code. With the fallback in place, a turn that displayed nothing
"answered" with its own statements, and the channel posted the agent's comments
and its `setActivity(...)` call into the thread as the reply.

`undefined` is the honest result for "it displayed nothing", and every caller
already had to handle it (a failed turn returns no result at all). A caller that
wants the reasoning has the tracer. In a channel that case reads as
`THING finished without posting an answer.` rather than a wall of source
`sdk/org/libs/cli/src/server/routes/team-channels.ts#renderResult`.

Otherwise a JSX answer is stored as `blocks` (descriptors reduced to allowed
components) with `text` carrying the flattened prose, so a client that cannot
draw components still has something to show and a notification has something to
read.

> **Known limitation.** Headless runs fail closed on consent-gated capabilities,
> so THING-in-a-channel cannot use a connection that would prompt for consent —
> the consent prompter is only wired for interactive sessions
> `sdk/org/libs/core/src/globals/consent.ts`.

## Unread, mentions and notifications

`.team/reads.json` records, per member per channel, when they last read it and how
many messages have named them since
`sdk/org/libs/cli/src/server/team-reads.ts`. `GET /api/team/channels` returns it
alongside the channels, because a sidebar that draws itself and then re-draws with
badges on is worse to look at than one that waits for both.

The two numbers are deliberately different in kind:

- **unread** is a boolean, DERIVED — from a POSITION in the channel, not from a
  clock. "Is there anything I have not seen" is `readSeq < lastSeq`, where
  `lastSeq` is where the log currently ends
  `sdk/org/libs/cli/src/server/team-channels.ts#lastMessageOf` and `readSeq` is
  what the member has read up to
  `sdk/org/libs/cli/src/server/team-reads.ts#ChannelReadState`. Still O(1) on the
  hot path — the end of a channel is in-process state the writer maintains, not a
  scan. An exact unread COUNT would mean scanning every log on every sidebar
  render, and is still not offered.
- **mentions** is a counter, MAINTAINED at write time
  `sdk/org/libs/cli/src/server/team-reads.ts#addMentions`. It has to be exact — a
  badge reading "2" when three people asked you something is worse than none —
  and it has to answer a client that has read no history. O(1) both ways.

It used to be `lastActivityAt(channel) > readAt` against the channel log file's
**mtime** `sdk/org/libs/cli/src/server/team-reads.ts#lastActivityAt`, and an
mtime is not a message counter. It moves for anything that writes the file — a
workspace restore rewrites every one of them — it has a resolution the ISO
timestamp it was compared against does not, so the same message could read as
already-seen or as never-seen depending on where a millisecond fell, and it
cannot express "I have read up to HERE" at all. That last one is why there was no
"new messages since" divider anywhere: nothing stored the boundary. `lastActivityAt`
survives only as the one-time fallback for read state recorded before positions
existed.

`markRead` records the position as well as the instant
`sdk/org/libs/cli/src/server/team-reads.ts#markRead`. It defaults to the end of
the channel — opening it means seeing what is in it — but a caller that knows the
exact message says so, and the delivery path does: marking the *sender* read to
the end of the channel would also mark them read on whatever a colleague posted
in the same instant. `GET /api/team/channels` returns `readMessageId` alongside
`hasUnread`, which is the divider.

They are drawn differently for the same reason: bold says "there is something
here" and can be ignored; a number says "somebody is waiting on you".

A DM counts every message as a mention of the other participant
`sdk/org/libs/cli/src/server/team-reads.ts#mentionAudience` — a direct message IS
addressed to you. THING's answer is stamped as a mention of whoever asked, because
an agent turn can take minutes, which is exactly the span over which somebody
closes the tab.

**Posting is reading**, up to your own message and no further: `POST …/messages`
marks the channel read for its sender at that message's position
`sdk/org/libs/cli/src/server/routes/team-channels.ts#handlePostMessage`.

`POST /api/team/channels/:channelId/read` marks a channel read (viewer-allowed),
optionally `{messageId}` for how far. The client calls it when a channel is
opened — opening a channel IS reading it.

### What may interrupt somebody

`pushAudience` is deliberately narrow `sdk/org/libs/cli/src/server/team-reads.ts#pushAudience`:
only members the message NAMED, only those with no live socket
`sdk/org/libs/cli/src/server/ws/team-channels.ts#connectedUserIds`, and only if
they have not already read it on another device. A busy channel you are in, or a
thread you once replied to, is what the badge is for — a notification that fires
for anything less than "somebody addressed me" trains people to switch
notifications off.

The pod does not talk to Web Push or FCM itself: those need long-lived credentials
and a store of every device a user has, and a per-team workload that scales to zero
and whose env an editor can rewrite is the wrong place for either. It asks the
gateway, one way, best-effort, and never lets a failed notification fail a
delivered message `sdk/org/libs/cli/src/server/team-push.ts#sendPushRequest`.
The gateway side → [../../cloud/routes.md](../../cloud/routes.md).

## Cross-references

- The team token, roles and membership → [../../cloud/teams.md](../../cloud/teams.md)
- How the edge picks a team's pod and projects the headers → [../../devops/infrastructure.md](../../devops/infrastructure.md)
- Session persistence and `runHeadlessThreaded` → [../../runtime/sessions.md](../../runtime/sessions.md)
