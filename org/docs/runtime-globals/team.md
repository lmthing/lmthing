# Team globals — `teamContext`, `teamMembers`, `teamChannels`, `teamHistory`, `teamPost`, `teamPinApp`

The globals THING gets **only inside a team workspace**: who is in the team, what channels
exist, what was said in them, and the ability to say something somewhere other than the
thread it was called from.

Before they existed, an agent answering in a channel knew exactly one thing about the team —
the `[email in #channel] ` prefix `promptFor` glues onto the message
`sdk/org/libs/cli/src/server/team-channels.ts#promptFor`. It could not name a colleague, tell
one channel from another, read what the team decided last week, or reach anywhere except the
reply slot it was woken in.

The surface, the capability that earns it, and the identity it acts under
`sdk/org/libs/core/src/globals/team.ts`.

---

## 1. Two capabilities, and why not one

| Capability | Config | Globals it earns |
|---|---|---|
| `team:read` | bare | `teamContext`, `teamMembers`, `teamChannels`, `teamHistory` |
| `team:post` | bare | `teamPost`, `teamPinApp` |

Both are bare-only — a config payload throws, like `store:read`
`sdk/org/libs/core/src/spaces/capabilities.ts#BARE_ONLY_CAPABILITY_IDS`. There is no
`{ channels: [...] }` narrowing because the scope is not a property of the *agent*: it is
whatever the **caller** can see, re-derived on every call (§3).

The split is load-bearing in two places, and a single `team:*` id could not have done either:

* **Read-only fork roles.** `intersectAppCaps` keeps `team:read` and drops `team:post`
  `sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps`, so an `explore`/`plan` leaf can
  look the team up and cannot broadcast into it. One id would have had to be kept whole
  (handing read-only forks the writers) or dropped whole (blinding them).
* **Least privilege for other agents.** A summarizing or routing agent that needs the
  directory has no business creating records in a shared log and raising other people's
  notification badges.

Reading discloses what the caller already sees in their own sidebar. Posting creates a
permanent message in a shared log and buzzes a phone. Those are different powers.

### There is no `teamDM`

"THING sends Bo a direct message" is a data-model change, not a feature. A `kind:'thing'`
message carries no `userId` `sdk/org/libs/cli/src/server/team-channels.ts#ChannelMessage`, and
`dmChannelId` hashes a sorted set of **user ids**
`sdk/org/libs/cli/src/server/team-channels.ts#dmChannelId` — so THING, having no id, cannot be
a participant in one. Every implementation is therefore one of two bad things: a DM sent *as
the asker* (the impersonation this whole surface exists to prevent), or a DM that needs an
invented THING principal the addressing scheme has no room for.

Reaching one person is a `teamPost` containing an `@handle`, resolved at write time
`sdk/org/libs/cli/src/server/team-members.ts#resolveMentions`. That raises the badge and sends
the push through machinery that already works, with no new identity. If agent DMs are wanted
later they need a real THING principal first, not a workaround in the resolver.

## 2. Inert on a personal pod — absent, not merely refused

The ids are known everywhere `sdk/org/libs/core/src/spaces/capabilities.ts#CAPABILITY_IDS`, so
a space file declaring one loads on any pod. The **grant** is dropped at the end of parsing
unless the gateway marked this pod a team pod
`sdk/org/libs/core/src/spaces/capabilities.ts#isTeamPod` — the core-side mirror of
`sdk/org/libs/cli/src/server/team-guard.ts#isTeamMode`, reading the same `LMTHING_TEAM_MODE=1`
container env var (set outside the editable `user-env` secret, so an editor cannot grant it
to themselves with a `PUT /api/compute/env`).

Because both the injector and the ambient-DTS builder read that same parsed model, dropping
the grant removes the globals **and** their declarations in one move — the general rule
"not granted ⇒ not injected AND absent from the DTS"
([README §2](./README.md#2-capabilities-gate-injection-and-the-dts)). On a personal pod a
model-authored `teamPost(...)` is therefore `Cannot find name 'teamPost'`: a clean, retryable
typecheck error the model sees and corrects, not a runtime throw.

Dropped, never rejected: THING's `instruct.md` is one file shipped to both kinds of pod
`sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:1-20`, so throwing would
make the system space fail to load on every personal pod. Validation still runs on every pod
(an unknown id, or a config on a bare-only team cap, throws everywhere), so a malformed
declaration cannot hide on a laptop and surface in production.

## 3. Identity is the caller's, and it is threaded, not ambient

Everything a team global does is attributable to the member who asked. That is not a
convention — there is no parameter for it:

```ts
declare function teamHistory(channelId: string, opts?: { limit?: number; before?: string }): Promise<…>;
declare function teamPost(channelId: string, text: string, opts?: { threadId?: string }): Promise<…>;
```

No `userId`, no `role`, no `teamId` anywhere on the model surface
`sdk/org/libs/core/src/typecheck/library-dts.ts#TEAM_READ_DTS`.

The hard part is that an agent turn **has no request**. Identity arrives as Envoy-projected
headers on the HTTP call that posted the message
`sdk/org/libs/cli/src/server/team-guard.ts#readCaller`; the turn it starts runs headless,
possibly minutes later, on a session shared by everyone in the thread. So the caller is
captured where it is trustworthy and passed as a **value**:

```
POST /api/team/channels/:id/messages          readCaller(req) → TeamCaller
  └─ handlePostMessage                        sdk/org/libs/cli/src/server/routes/team-channels.ts#handlePostMessage
       └─ beginThingReply(…, caller)          sdk/org/libs/cli/src/server/routes/team-channels.ts#beginThingReply
            └─ runThingReply(…, caller)       builds the per-turn resolver
                 └─ createTeamResolver(root, { caller, channel, threadId }, hooks)
                      sdk/org/libs/cli/src/server/team-globals.ts#createTeamResolver
                 └─ SessionManager.runHeadlessThreaded({ …, team })
                      sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.runHeadlessThreaded
                      └─ appGlobals.team → YieldRouterContext.teamResolver
```

There is no ambient "current caller" and no mutable the sandbox could reach. A turn started
without a verified caller (only possible off the edge) gets **no** `team` resolver at all,
and every team yield rejects rather than guessing an identity
`sdk/org/libs/cli/src/server/routes/team-channels.ts#runThingReply`.

`team` is the one entry in `AppGlobalImpls` bound to the **turn** rather than the project
`sdk/org/libs/core/src/exec/app-globals.ts#AppGlobalImpls.team`, which is why it is merged
onto the project's globals in `buildProjectSessionArgs` instead of being assembled inside the
per-project `getProjectAppGlobals` cache
`sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.buildProjectSessionArgs`.

Delegates and forks receive the parent's resolver unchanged
(`sdk/org/libs/core/src/delegate/delegate.ts:496-505`,
`sdk/org/libs/core/src/fork/fork.ts:548-556`): a delegate acts for the same caller in the same
channel. What it may *call* is still its own grants' business.

## 4. What each global does

All six are **value-yielding** — they push a `YieldRequest` and end the turn, resolved by
one arm of the router `sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`.

### `team:read`

```ts
teamContext(): Promise<{ teamId; channelId; channelName; channelKind: 'channel'|'dm'; threadId?; caller: { userId; email?; handle?; displayName?; role: 'viewer'|'editor' } }>
teamMembers(): Promise<Array<{ userId; label; handle?; displayName?; email?; isCaller }>>
teamChannels(): Promise<Array<{ id; name; kind; categoryId?; apps? }>>
teamHistory(channelId, { limit?, before? }): Promise<{ messages: […]; hasMore }>
```

* `teamContext` answers "who asked, in which channel, in which thread" — the turn's own
  coordinates, including the caller's `role` so the agent can explain a refusal instead of
  retrying it `sdk/org/libs/cli/src/server/team-globals.ts#createTeamResolver`.
* `teamMembers` returns the whole directory with a `label` chosen the way the UI chooses it
  (display name, else `@handle`, else email) `sdk/org/libs/cli/src/server/team-members.ts#memberLabel`.
  Nothing here is private: it is the same list the mention picker shows every member.
* `teamChannels` filters on `sdk/org/libs/cli/src/server/team-channels.ts#isVisibleTo`, so a DM
  the caller is not in is **not listed**.
* `teamHistory` pages a channel's log newest-last, over the same reader the REST route uses
  `sdk/org/libs/cli/src/server/team-channels.ts#readMessages`. This is how "what did we decide
  about X last week" gets answered.

### `team:post`

```ts
teamPost(channelId, text, { threadId? }): Promise<{ ok; channelId; messageId?; receipt? }>
teamPinApp(channelId, projectId): Promise<{ ok; channelId; apps }>
```

* Every message these append is `kind: 'thing'` with **no** `userId`
  `sdk/org/libs/cli/src/server/team-globals.ts#createTeamResolver`, so an agent post can never
  be read as a member's own words. `@handle`s in the text are resolved at write time, exactly
  as for a member's message `sdk/org/libs/cli/src/server/team-members.ts#resolveMentions`, so a
  person THING names actually gets a badge — and that is the only way to reach one person.
* A post reaches the channel sockets and the delivery bookkeeping through hooks the route
  supplies `sdk/org/libs/cli/src/server/team-globals.ts#TeamGlobalsHooks`. Each message is
  announced with the channel it **landed in**, which is what the route turns into
  `audienceFor(channel)` `sdk/org/libs/cli/src/server/ws/team-channels.ts#broadcastChannelEvent`
  — announcing a DM's message against the originating channel is exactly how a private
  conversation would leak to every connected socket.
* `teamPinApp` refuses a project that does not exist, so a pin never leaves a dead tile in
  the sidebar. Pinning twice is idempotent
  `sdk/org/libs/cli/src/server/team-channels.ts#patchChannel`.

### Attribution and the receipt

A message from an assistant, in a channel nobody present asked in, is indistinguishable from
a bug unless it says whose request produced it. So a `teamPost` carries two extra records:

* **`onBehalfOf: { userId, label }`** on the posted message
  `sdk/org/libs/cli/src/server/team-channels.ts#ChannelMessage`, rendered as "THING · for Ana".
  It is also the authority record — the post was made under that member's visibility and role
  — and it is what the push notification names
  (`sdk/org/libs/cli/src/server/routes/team-channels.ts#deliver`).
* **A receipt in the originating thread.** When the post lands somewhere other than the
  channel the turn is running in, a `system` message is appended back into that thread
  carrying `postedTo: { channelId, channelName, messageId }` — the same typed-field pattern as
  the app card `sdk/org/libs/cli/src/server/routes/team-channels.ts#announceNewApps`, so a
  client renders an affordance instead of parsing prose and a reader scrolling back still sees
  it. `receipt: true` on the result tells the turn it happened, so it does not narrate it
  twice. A write the originating conversation cannot see is a write nobody can audit.

### Reads are bounded, and say what they read

`readMessages` allows up to 200 `sdk/org/libs/cli/src/server/team-channels.ts#readMessages`,
which is a fine ceiling for a UI that pages on scroll and a bad one for an agent: 200 messages
is most of a turn's context spent on a channel nobody asked it to summarize. `teamHistory`
caps at **100**, defaults to **30**, and reports the limit it applied along with `channelName`
and `returned` `sdk/org/libs/cli/src/server/team-globals.ts#createTeamResolver` — so the turn
can say "I read the last 30 messages of #design" and a reader can tell what was and was not
looked at. More history is a deliberate walk backwards through `before`, one page at a time.

> THING's ordinary reply is **not** a `teamPost` — whatever it `display()`s is already posted
> into the thread it was asked in `sdk/org/libs/cli/src/server/routes/team-channels.ts#runThingReply`.
> `teamPost` is for when the request is genuinely about somewhere else.

### The writers are reachable from exactly ONE tasklist node

Holding the capability is not the same as being able to reach it from wherever a turn happens
to be. Across every shipped space, exactly one tasklist node calls `teamPost`/`teamPinApp` —
the terminal `post` node of THING's `tell_the_team`, which chooses neither its channel nor its
words (both are settled upstream by `explore` nodes that `intersectAppCaps` has already
stripped the writers from)
`sdk/org/libs/core/system-spaces/user-thing/tasklists/tell_the_team/03-post.md:L1-L38`. A new
node that grants itself the writers — or one that simply omits `capabilities:` and therefore
inherits THING's whole set — fails a class guard
`sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts:L359-L376`. The reason is the failure
mode: a step that can both *look things up* and *broadcast* is how one "let the others know"
request ends up posting into the wrong channel and then posting a correction on top of it.
The workflows themselves → [system-spaces §6](../system-spaces/README.md#the-three-team-workflows--reachable-only-on-a-team-pod).

## 5. The two refusals

Both are enforced host-side, in the resolver, where the caller is known — never in prose and
never in the sandbox `sdk/org/libs/cli/src/server/team-globals.ts#createTeamResolver`.

**A viewer cannot write through the agent.** `guardRequest` keeps viewers out of the mutating
REST surface `sdk/org/libs/cli/src/server/team-guard.ts#guardRequest`; a viewer who could say
"THING, announce this in #general" and have it happen would have walked around that guard, so
both writers refuse when `caller.role !== 'editor'`. Viewers keep every reader — the
split is read-vs-write, not agent-vs-no-agent.

> This is deliberately **stricter** than the REST surface, which lets a viewer post a message
> of their own into a visible channel `sdk/org/libs/cli/src/server/team-guard.ts:74-76`. A
> viewer speaking as themselves in the channel they are in is their right; the agent posting
> as THING, into any channel, on a viewer's instruction is an amplification of it.

**A DM the caller is not in does not exist.** `teamHistory` and `teamPost` resolve the channel
through one predicate and reject with the *same wording* an unknown id gets
(`no such channel: <id>`), because the distinction between "not visible" and "not there" is
exactly the private information the check exists to protect.

## 6. The third gate — no resolver

The grants are pod-wide; the **context** is per-turn. A THING session in Studio or `/chat` on
a team pod therefore holds `team:read`/`team:post` and has no channel to answer in. Those
calls reject with a message that says so
`sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`:

```
teamContext is not available here: this turn is not running in a team channel
(team globals resolve against the message that started the turn)
```

The CLI's one-shot `--request` path deliberately supplies no resolver either — it is a local
operator on a terminal, not a colleague in a channel `sdk/org/libs/cli/src/cli/bin.ts:608-620`.

## 7. Where it is tested

| Property | Test |
|---|---|
| grant dropped on a personal pod; kept on a team pod | `sdk/org/libs/core/src/globals/team.test.ts` |
| readers declared only under `team:read`, writers only under `team:post`, neither with no grant | `sdk/org/libs/core/src/globals/team.test.ts` |
| an `explore` fork keeps the readers, loses the writers | `sdk/org/libs/core/src/globals/team.test.ts` |
| no identity ever appears in a yield's args | `sdk/org/libs/core/src/globals/team.test.ts` |
| viewer refused / editor allowed, for both writers | `sdk/org/libs/cli/src/server/team-globals.test.ts` |
| DM invisible to a non-participant, readable by a participant | `sdk/org/libs/cli/src/server/team-globals.test.ts` |
| `onBehalfOf` stamped; receipt written to the originating thread; each message announced against the channel it landed in | `sdk/org/libs/cli/src/server/team-globals.test.ts` |
| history capped at 100 (30 default) and the cap reported | `sdk/org/libs/cli/src/server/team-globals.test.ts` |
| the channel route really hands the turn a resolver bound to the requesting member | `sdk/org/libs/cli/src/server/team-globals.test.ts` |

---

See also: [team mode, roles and channels](../cli-api/rest/team.md) ·
[teams on the gateway](../cloud/teams.md) ·
[capability frontmatter](../format/space/agents/capabilities.md)
