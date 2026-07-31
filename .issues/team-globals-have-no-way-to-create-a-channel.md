# THING cannot create a channel — the team globals have no verb for it, so "give it its own room" builds a SPACE instead

**Symptom** (scenarios/21-newsroom run 1 step 4, 2026-07-31): Pilar asked for a story to be given
somewhere of its own —

> *"the school closure is turning into a much bigger thing — there are three schools now and the
> regional government is involved. Tomás and Nadia are both on it. Can you give it somewhere of its
> own so it stops clogging up the desk?"*

After 340 seconds THING answered:

> **School closures — now in its own space.** *The tracking app and specialist space are live. Tomás
> and Nadia can drop updates directly into it — no more clogging up #newsroom with back-and-forth on
> this one. Open it now at the Alcalá Post project…*

The channel list is unchanged: `["general", "newsroom"]` (`runs/1/step-04.json`, `channels`). No
channel was created, and none could have been.

## The capability does not exist

`sdk/org/libs/core/src/globals/team.ts:158-174` — the whole team surface:

```ts
export interface TeamResolver {
  context(): Promise<TeamTurnInfo>;
  members(): Promise<TeamMemberInfo[]>;
  channels(): Promise<TeamChannelInfo[]>;                       // READ
  history(channelId, opts?): Promise<TeamHistoryPage>;          // READ
  post(channelId, text, opts?): Promise<TeamPostResult>;
  pinApp(channelId, projectId): Promise<TeamPinResult>;
}
export type TeamYieldKind =
  | 'teamContext' | 'teamMembers' | 'teamChannels' | 'teamHistory' | 'teamPost' | 'teamPinApp';
```

Six verbs; the only two that write are "post a message" and "pin an app". `channels()` lists.
There is **no create-channel**, no rename, no invite. The REST route exists and works
(`POST /api/team/channels`, `routes/team-channels.ts#handleCreateChannel`, editor-only) — it is
simply not reachable from an agent turn.

So 21-newsroom step 4's expectation — *"THING creates a new channel for that story. It does not
create a project, a document or a chat session and call it a room"* — is **not satisfiable by any
correct behaviour** on today's surface. THING did the nearest reachable thing (a specialist space
plus an app) and described it as *"its own space"*.

## Two separate faults, and only one is THING's

1. **Missing capability** (the real one): a team's assistant that can post into channels but cannot
   make one cannot organise the team's own workspace, which is 21-newsroom's whole promise. If
   creating a channel is meant to be possible, `TeamResolver` needs a `createChannel(name, opts?)`
   bound host-side to the verified caller (so a viewer's turn cannot create one), routed exactly as
   the other six are (`libs/core/src/eval/yield-router.ts:371-410`), and granted under `team:post`
   or a new `team:manage`.
2. **THING answered in product vocabulary.** *"in its own space"*, *"specialist space"*, *"the
   Alcalá Post project"* — the persona explicitly never uses those words, and neither should the
   reply. Even absent the capability, the honest answer is "I can't make you a room; here is what I
   can do instead" — the same shape the capability rules require for paying a card or sending money.

Also unmet, downstream of the same gap: *"Tomás and Nadia are told — the people actually on the
story"*. `teamMembers` was not called on this turn, and no message reached either of them.

## Evidence

- `sdk/org/scenarios/21-newsroom/runs/1/step-04.{json,full.json}` — `wrote.globals` is
  `["tasklist","display","teamContext"]`; `channels` unchanged.
- `sdk/org/scenarios/21-newsroom/runs/1/data/.lmthing/.team/channels.json` — two channels.

## Verify a fix

Replay 21-newsroom step 4. `GET /api/team/channels` must gain a channel named for the story, the
turn's `wrote.globals` must contain the new create verb, and the two members named in the message
must be the ones the directory says are on it. If the decision is instead that THING may NOT create
channels, then the scenario's expect is wrong and should be rewritten to require an honest refusal —
but the current state, where it silently substitutes a space and calls it a room, is wrong either
way.
