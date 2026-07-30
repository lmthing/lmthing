# Team surface — UX defect audit (handover)

**Read-only audit, 2026-07-31.** No source file was changed; this document is the only output.
Every finding cites `path:line` (repo-relative). Findings are ranked by **user impact**, not by cost
to fix, and tagged **defect** (it is wrong), **gap** (it was never built) or **polish**.

## How this document is split

- **[Part A](#part-a--rendering-layout-and-component-findings)** — rendering, layout and component
  findings. These belong to the **concurrent UI/UX session** (`design/team-chat-ux-progress.md`),
  which owns `sdk/org/libs/ui/src/team/**`, `sdk/org/apps/web/src/routes/team/**`,
  `sdk/org/apps/mobile/**` and `sdk/org/apps/web/tests/surface-shots/**`. Each finding states **what
  the screenshot gate would have to show** for it to count as fixed.
- **[Part B](#part-b--pod-protocol-and-api-findings)** — everything that is not rendering: the pod,
  the message model, the socket protocol, the REST surface, and what THING can know and do. Owned by
  the coordinator.
- **[Part C](#part-c--boundary-cases)** — findings whose *cause* is in Part B territory but whose
  *code* lives in a file Part A owns. Flagged explicitly so nobody double-edits.

### Scope read

`sdk/org/libs/ui/src/team/**` (all 12 files), `sdk/org/apps/web/src/routes/team/**` (all 7),
`sdk/org/apps/mobile/src/TeamScreen.tsx`, `sdk/org/libs/cli/src/server/routes/team-channels.ts`,
`ws/team-channels.ts`, `server/team-channels.ts`, `team-guard.ts`, `team-reads.ts`,
`routes/uploads.ts`, `sdk/org/libs/ui/src/chat/**` for comparison, plus `org/docs/cloud/teams.md`,
`org/docs/cli-api/rest/team.md`, `org/docs/mobile/README.md` and the `design/teams-*` docs.

> `sdk/org/libs/cli/src/server/team-channels.ts` carries a raw NUL at **line 292**
> (`[...].sort().join('\x00')` — an intentional delimiter before hashing a DM's sorted user ids), so
> **grep treats the file as binary and skips it silently**. Every symbol in it — `ChannelMessage`,
> `appendMessage`, `readMessages`, `mentionsThing`, `promptFor`, `threadRootOf` — is invisible to a
> grep sweep. Read it with `python3 -c "print(open(p, encoding='utf8', errors='replace').read())"`.

### Gate status observed during this audit

- `pnpm lint:tokens` → **✓ no violations in 732 files.** There are **no design-token violations in
  the team surface**. The `rgba(0,0,0,…)` literals in it are *explicitly permitted* as achromatic
  scrims/shadows (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:53-67`). One of them is still a
  bug for an unrelated reason — A11.
- `pnpm test:native` **passes on main** (confirmed by the coordinator). The claim in
  `design/teams-mobile-ux.md` that both native gates are red is **out of date**; do not carry it
  forward.

---

## The one-line verdict

**A team channel is a send-only surface with a hidden reply.** You cannot stay scrolled up in it
(A1), you cannot reach anything older than the last 50 messages (B9/A9), and when you talk to THING
the answer is not on the screen you asked from (A3) — it is behind a "1 reply" strip, produced by an
agent that shows a pulsing dot for the several minutes it works (B2) and whose failures are drawn as
the quietest text on the page (A5/B6). Almost everything else is downstream of those five.

---

# Part A — rendering, layout and component findings

*Owner: the concurrent UI/UX session. Pass conditions are written for `pnpm shots`
(`sdk/org/apps/web/tests/surface-shots/`, 390×844 and 1440×900, both themes).*

Where a pass condition needs something a still image cannot judge — scroll offset, a computed box
size — I say so and propose the assertion instead. Those are the cases where the shooter needs a new
capability, not a new picture.

### A1 · S1 · defect · You cannot stay scrolled up in a channel

**What a user sees.** Scroll up to re-read something; a colleague starts typing, or THING posts an
activity update, and the view snaps to the bottom mid-sentence. Worst exactly when the channel is
busiest, and worst of all while THING is working.

**Cause.** The web `Scroll` primitive's pin effect has **no dependency array** and jumps to the
bottom on *every render*:

```
sdk/org/libs/ui/src/elements/primitives/scroll/index.tsx:37-41
  React.useLayoutEffect(() => {
    if (!stickToEnd) return
    const el = own.current
    if (el) el.scrollTop = el.scrollHeight
  })                                   // ← no deps
```

The team transcript and the thread rail both pass `stickToEnd` **unconditionally**
(`sdk/org/libs/ui/src/team/channels-view.tsx:258` and `:462`). Every socket frame re-renders
`TeamChannelsView` — `typing` (`use-team-chat.ts:231-245`), `thing_status` activity
(`:216-230`), `message` (`:191`) — and each one re-runs the effect. Activity frames are broadcast
unthrottled, once per `setActivity()` call (`routes/team-channels.ts:719-723`).

`/chat` already solved this: `stickToEnd={follow && atBottom}` (`chat/app/ChatView.tsx:288`), an
`atBottom` tracker with a 60px threshold (`:141-147`), a follow toggle (`:228-240`) and a floating ↓
button (`:322-330`).

**Fix.** Give the team transcript the same shape. Separately, the primitive's dependency-less
`useLayoutEffect` is a footgun for every future caller and should key on a caller-supplied token
(e.g. the last message id) — but that primitive is shared with `/chat`, so change it deliberately.

**Screenshot pass condition.** A still cannot show a yank. Needs a **scripted shot**: seed ≥40
messages, scroll the transcript to offset 0, dispatch one in-memory `typing` frame, then shoot.
Pass = the shot shows the **oldest** message at the top (i.e. offset unchanged) **and** a
scroll-to-bottom ↓ affordance visible in the lower-right of the transcript. A second shot at the
bottom must show no ↓ button.

### A2 · S1 · defect · The transcript is top-aligned *(already found by the UI session)*

Confirmed independently. The messages column has no bottom-alignment, so a short conversation sits
at the top with a void above the composer (`channels-view.tsx:258` — `Prim.Scroll` with
`flexDirection="column"` and no `justifyContent`/`marginTop:auto` on the content). Chat convention is
that new messages rise from the composer.

**Screenshot pass condition.** With 3 seeded messages, at both viewports and both themes: the last
message's bounding box sits directly above the composer with no more than one `$4` gap; the empty
space is *above* the first message.

### A3 · S1 · defect · THING's answer never appears in the channel you asked from

**What a user sees.** You type `@thing what did we ship last week?` in `#general`. The answer does not
appear. The channel shows your message and a small "1 reply · 2m ago" strip. On a phone this is
worse: `MessageActions`' hover toolbar is inert on touch (`messages.tsx:349-351`), so the strip is
the only hint an answer exists at all.

**Cause.** Every THING reply carries the asking message's id as `threadId`
(`routes/team-channels.ts:730-741`), and the channel transcript renders roots only:

```
sdk/org/libs/ui/src/team/channels-view.tsx:158
  const roots = useMemo(() => chat.messages.filter((m) => !m.threadId), [chat.messages])
```

The Slack shape is defensible for human threads (reasoning at `channels-view.tsx:405-413`). It is
wrong for the *first* THING reply to a channel-level mention, when the "thread" contains exactly one
message — the thing the asker wants to read.

**Fix (client-only).** Inline the first THING reply under its root in the channel transcript — a
preview of its first block plus "open thread" — and collapse to the "N replies" strip only once the
thread has more than one reply.

**Screenshot pass condition.** Seed a root `@thing …` user message plus one `kind:'thing'` reply
carrying `blocks`. At both viewports: the reply's rendered content is visible in the channel
transcript, indented under the asking message, without opening the rail.

### A4 · S1 · defect · The activity line is grammatically mangled, and discarded at channel level

**What a user sees.** Open the thread while THING builds something and read:

> ● **THING — reading the orders schema is typing…**

**Cause.** The thread rail passes the activity text as a *typing label*
(`channels-view.tsx:478`), and `TypingStrip` formats every label as `${labels[0]} is typing…`
(`messages.tsx:485-490`). Two different facts — "a human is typing" and "the agent is at step N" —
share one template. At **channel** level the activity is discarded entirely: `ThreadSummary` receives
only `busy` (`channels-view.tsx:276-281`) and prints the constant `'THING is working…'`
(`messages.tsx:477`), though `chat.activity` is right there in the hook (`use-team-chat.ts:54, :417`).

**Fix.** A distinct THING status strip (✦ + "THING is working" + the activity sentence + elapsed),
separate from `TypingStrip`; and pass `chat.activity.get(root.id)` into `ThreadSummary`.
See **B2** for what the protocol can and cannot feed it.

**Screenshot pass condition.** Seed `thinking={root.id}` and `activity="reading the orders schema"`.
The thread rail shot must contain the substring "reading the orders schema" and must **not** contain
"is typing". The channel shot must show the same activity text on the thread-summary row, not the
constant "THING is working…".

### A5 · S2 · defect · A THING failure is the quietest thing on the screen

**What a user sees.** A build fails after four minutes and they get, centred, italic, in the smallest
muted type on the page:

> *THING could not answer: Cannot read properties of undefined (reading 'columns')*

Identical treatment to "Rota is ready." No colour, no icon, no retry.

**Cause (rendering half).** `SystemMessage` draws any system message without an `app` as tiny centred
italic muted text:

```
sdk/org/libs/ui/src/team/messages.tsx:296-300
  <Prim.Text fontSize="$xs" color="$muted-foreground" fontStyle="italic" textAlign="center">
```

`/chat` renders a bordered destructive-toned monospace error block
(`chat/app/Message.tsx:272-280`). The protocol half — that an error is a `kind:'system'` row with the
raw exception flattened into `text` — is **B6**, and the two need to land together.

**Screenshot pass condition.** Seed a message the client can identify as an error. It must render as
a left-aligned block with a `$destructive`-toned border or background, a plain-English lead line, and
a visible **Retry** control — distinguishable in the shot from a seeded `"Rota is ready."` card in
the same transcript.

### A6 · S1 · defect · A parked question is indistinguishable from an answer

**What a user sees.** THING asks a question in the thread. It looks exactly like an ordinary THING
message — no form, no highlight, no "answer this" — while the busy indicator keeps saying THING is
working, so the reader waits instead of replying.

**Cause (rendering half).** The question is stored as a plain `kind:'thing'` row and rendered through
the same `MessageBody`/`renderDescriptor` path as an answer (`messages.tsx:166-178`). Nothing in the
row distinguishes it. The protocol half — no ask identity on the row, no park status, any reply
consumes it — is **B4**, and it must land first because the client has nothing to branch on today.

`/chat` renders a real interactive card: `AskForm` → `ConsentCard` / a registered space component /
`CatalogForm` / a text input, with a "✓ answer preview" once answered and the block greyed inert
(`chat/app/Message.tsx:41-105`). **All of those components are already exported and target-agnostic**
(`chat/index.ts:6-10`) — the channel can mount them unchanged.

**Screenshot pass condition.** Once B4 lands: seed a parked ask. The shot must show a bordered card
visually distinct from the adjacent answer message, containing the question, an input, and a submit
control; and the thread's status strip must read "waiting for an answer", not "working".

### A7 · S2 · defect · On a phone, starting a thread is undiscoverable

**What a user sees.** Nothing ever suggests a message can be replied to. This matters far more here
than in Slack, because a thread is the only way to have a back-and-forth with THING — a channel-level
post needs an explicit `@thing` every time (`routes/team-channels.ts:610-619`).

**Cause.** The only entry point is `MessageActions`, revealed by hover — inert on touch, as its own
comment says (`messages.tsx:344-355`) — with an unlabelled long-press fallback (`messages.tsx:364`).
`ThreadSummary` renders `null` until a reply exists (`messages.tsx:452`).

**Screenshot pass condition.** Phone shot (390×844) of a channel with 3 replyless messages: a visible
reply affordance is present on at least the last message of each sender group.

### A8 · S2 · defect · Tap targets are 36px throughout

**Cause.** `Button size="icon"` is `$9 × $9`; the scale unit is 4px
(`sdk/org/libs/css/src/tamagui/tokens.generated.ts:560-561`, "Tailwind spacing scale (unit = 4px)"),
so **36×36** — under the 44px minimum. `sdk/org/libs/ui/src/elements/forms/button/index.tsx:68`.
Call sites that survive to compact: drawer close `sidebar.tsx:397`, section menu `sidebar.tsx:418`,
channel move `sidebar.tsx:471`, header hamburger `rail.tsx:81`, app-pin `+` `rail.tsx:150`, rail
close `rail.tsx:314`, error dismiss `channels-view.tsx:245`, composer Send `composer.tsx:262`.
Mention-picker rows are ~32px (`composer.tsx:305-306`). `BottomTabs` gets it right
(`minHeight: 48`, `elements/nav/bottom-tabs/index.tsx:64-66`) — nothing else follows.

**Pass condition — an assertion, not a picture.** A screenshot cannot measure a box. Add to the
shooter: at 390px, every element with a `role="button"`/`aria-label` inside the team surface has a
client rect ≥ 44×44. That single assertion also protects the other surfaces.

### A9 · S1 · gap · There is no scrollback control

**What a user sees.** A channel older than a couple of days has no history and no "load more".

**Cause (client half).** The server paginates fine — `limit` default 50, cap 200, `before` cursor
(`server/team-channels.ts:453`, `routes/team-channels.ts:491-494`) — but the client sends none of it
and discards `hasMore`:

```
sdk/org/libs/ui/src/team/client.ts:40   messages(channelId: string): Promise<{ messages; hasMore }>
sdk/org/libs/ui/src/team/client.ts:88   messages: (channelId) => call(`/channels/${channelId}/messages`),
sdk/org/libs/ui/src/team/use-team-chat.ts:153   const { messages: history } = await client.messages(activeId)
```

**Fix.** Widen `TeamClient.messages(channelId, opts?: {before?, limit?})`, keep `hasMore`, and render
a "Load earlier messages" row at the top. **Read B10 first** — the server's stale-cursor path is
wrong and will bite this change.

**Screenshot pass condition.** Seed a client whose `messages()` returns `hasMore: true`. The
transcript's first row is a visible "Load earlier messages" control at both viewports.

### A10 · S2 · gap · The phone app has no Members, Settings or Projects

**What a user sees.** On the phone a team is channels and nothing else. No roster, no invites, no way
to set a display name or handle, no notification settings, no projects.

**Cause.** `apps/mobile` mounts one team surface — `sdk/org/apps/mobile/App.tsx:258-260` renders
`<TeamScreen …>`, which renders only `TeamChannelsView`
(`sdk/org/apps/mobile/src/TeamScreen.tsx:127-159`). `Rail` is closed to two kinds
(`sdk/org/libs/ui/src/team/types.ts:93-95`), so there is no shared component to mount even if a route
existed. The four tabs are web-only
(`sdk/org/apps/web/src/routes/team/$teamId/route.tsx:69-74, :159-165`).

This compounds: `memberLabel` prefers a display name (`format.ts:32-35`) and the `@` picker skips
anyone with no handle (`composer.tsx:57-61`), but the only place to set either is web Settings. A
phone-first member is permanently un-mentionable and appears to everyone as a raw email.
Still-open per `design/teams-mobile-ux.md:8-12` and `org/docs/mobile/README.md:519`.

**Fix.** Extend `Rail` with `{kind:'members'}` / `{kind:'settings'}` and lift the two web pages'
bodies into `libs/ui/src/team/`. **Prioritise the profile half** (display name + handle) — it is
small and unblocks identity and mentions for every phone user.

**Screenshot pass condition.** A phone shot of the members rail and the profile rail, each reachable
from the channels view, with the handle field visible and editable.

### A11 · S3 · defect · The phone drawer has no elevation

`boxShadow: '0 0 40px rgba(0,0,0,0.18)'` (`sidebar.tsx:163`) is a web CSS shorthand; the native style
translator knows only `shadowColor`/`shadowOffset`/`shadowRadius`, so it is dropped and the
slide-over sits flat against the transcript behind it. **Not** a token violation — the gate permits
achromatic shadows.

**Pass condition.** A native render assertion (`pnpm test:native`) that the compact sidebar carries a
resolved `shadowColor`/`shadowRadius`; the web shooter cannot see this.

### A12 · S2 · gap · On a phone, THING is undiscoverable after the first message

The `@thing` hint is deliberately dropped from the composer placeholder on compact because it wrapped
and clipped (`channels-view.tsx:290-302`) — reasonable. The compensating hint is the channel empty
state (`channels-view.tsx:393`, "Ask THING" at `:396-400`), which renders only when
`roots.length === 0` (`channels-view.tsx:259`). So on any channel that already has messages, a phone
user is never told an agent lives here.

**Fix.** An ✦ affordance in the channel header on compact that prefills `@thing ` — the `prefill`
plumbing already exists (`composer.tsx:85-91`, `channels-view.tsx:263`).

**Screenshot pass condition.** Phone shot of a channel with ≥1 message shows a persistent THING
affordance in the header.

### A13 · S3 · defect · A draft survives a channel switch

`Composer` is never keyed or remounted on `activeId` (`channels-view.tsx:289-310`, draft state at
`composer.tsx:104`), so half a sentence typed in `#general` is still in the box when you open
`#design`. *(Note: the lack of a remount is also what protects the native keyboard — see the native
note below. Fix by clearing the draft on `activeId` change, **not** by adding a `key`.)*

**Pass condition.** A scripted interaction shot: type, switch channel, shoot — the composer is empty
and shows the new channel's placeholder.

### A14 · S3 · gap · No date separators, no unread divider, no ageing timestamps

There is no day separator in the transcript (`channels-view.tsx:266-284`), no "new messages since"
divider, and `relativeTime` (`format.ts:18-24`) is computed at render with no ticker, so "just now"
never ages and no absolute time is available anywhere. *(The `relativeTime` half was already found by
the UI session.)*

**Pass condition.** A seeded transcript spanning two days shows a dated separator between them, and
hovering/long-pressing a timestamp reveals an absolute time.

### A15 · S3 · polish · Hardcoded pixel dimensions where the scale is the rule

Sidebar width `sidebar.tsx:154` (`280`/`230`); empty-state circle `channels-view.tsx:374-376`
(`56`); copy width `channels-view.tsx:390` (`280`); app card `messages.tsx:257` (`420`); rail bounds
`rail.tsx:36-38`.

### A16 · S3 · polish · Dead code and a stray comment

A duplicated four-line block comment above the transcript (`channels-view.tsx:251-257`) and a doc
comment with no declaration under it at the end of the file (`channels-view.tsx:499`).

### A17 · S3 · polish · Web sub-pages are cramped at 390px

`padding="$6"` (24px each side) on Members and Projects leaves 342px of content
(`members.tsx:105`, `projects.tsx:51`), and member rows carry avatar + email + role badge + a 36px
menu with no truncation on the email `Prim.Text` (`members.tsx:164-168`) — it wraps rather than
clipping, so this is uncomfortable rather than broken. `settings.tsx` is 513 lines including an
embedded Stripe checkout and **I did not review its compact layout** — worth a shot.

### Phone: what is already fixed (do not re-litigate)

The 576px-forced-viewport class of defect **is gone**. `TeamChrome` renders four equal bottom tabs
below `md` and keeps only identity in the top bar (`routes/team/$teamId/route.tsx:90-167`);
`BottomTabs` insets for the home indicator and clears 48px (`elements/nav/bottom-tabs/index.tsx:40-67`);
the rail covers the screen with a named back row instead of a corner `×` (`rail.tsx:230-243, :276-299`);
the drawer has both a scrim and an explicit close (`channels-view.tsx:200-209`, `sidebar.tsx:394-400`);
`Prim.Scroll` fixed the Yoga clipping that used to end a conversation at the first screenful.
Nothing I read forces a document wider than the viewport — every row that could is
`flex:1 minWidth:0`, and the sidebar is `maxWidth="85%"` (`sidebar.tsx:155`). Also verified clear: the
empty-state circle and `SenderAvatar` centre correctly via a `Box` around a `Text`
(`channels-view.tsx:372-385`, `messages.tsx:190-210`); the app card's "Open" no longer clips
(`messages.tsx:276-289`); the rail's mouse-only resize listeners are guarded off native
(`rail.tsx:204-224`); the mention picker uses `onPress` on native because `onMouseDown` is dropped
(`composer.tsx:313-326`); the native `Scroll` sets `keyboardShouldPersistTaps="handled"`
(`scroll/index.native.tsx:69-71`).

**Native keyboard / composer remount — checked, no hazard found by reading.** `Composer` sits in a
fixed, unconditional JSX position under the transcript in both the channel
(`channels-view.tsx:289-310`) and the thread rail (`:480-494`); it is not keyed on `activeId`, not
conditionally wrapped, and its parent component identity does not change on a channel or team switch.
`KeyboardAvoidingView` is applied once at the app root (`apps/mobile/App.tsx:87-96`). No `autoFocus`,
no blur-on-send (`composer.tsx:185-198`); the one focus call is the deliberate prefill effect
(`composer.tsx:122-131`). **This is a read-only conclusion — a device run is what would prove it.**

---

# Part B — pod, protocol and API findings

*Owner: the coordinator. This is the half where the shape of the data decides what any UI can ever
show, so each item states **what the protocol carries today** before saying what is missing.*

### B1 · S1 · gap · The socket protocol carries no streaming, no update, no presence, no connection state

**What it carries.** The complete server→client union is six frames
(`sdk/org/libs/cli/src/server/ws/team-channels.ts:27-59`): `message`, `thing_status`, `typing`,
`channel`, `categories`, `app_created`. Client→server is exactly one: `{type:'typing', channelId}`
(`:62`).

**What follows.**

- **No streaming.** THING's answer arrives as one whole `{type:'message'}` after the entire turn has
  rendered (`routes/team-channels.ts:742`). No UI can show partial output, because no partial output
  is sent. Deliberately deferred: `design/teams-handoff.md:73-78` ("Live token streaming for THING in
  a channel … Streaming is an optional `onTrace` away").
- **No message update/edit frame.** Once a message is delivered nothing can revise it. This forecloses
  the obvious cheap design for progress — post a placeholder row and patch it — and forecloses edit,
  delete, and reactions later. **If you add one frame, add this one**; it unlocks more UI than any
  other single change.
- **No presence.** `connectedUserIds()` exists (`ws/team-channels.ts:175-179`) but is used only to
  suppress push (`team-reads.ts:186-203` via `routes/team-channels.ts:637`) and is never sent to a
  client. The union has no presence member. So "who is here" is unrenderable today.
- **No connection state.** The socket is fire-and-forget: `guardWebSocket` authorises the upgrade,
  then nothing. There is no ping/pong, no server-side close reason a client could show, and no resume
  cursor — a client that reconnects has no way to ask "what did I miss" other than re-fetching the
  channel. Combined with **C1** (the client has no reconnect at all) this is the single most
  user-visible protocol gap.
- **Ordering has no key.** See B8.

### B2 · S1 · gap · `thing_status` + `activity`: exactly what they carry, and what a UI could never show

**Carried.** `{type:'thing_status', channelId, threadId, status:'running'|'done'|'error', activity?}`
(`ws/team-channels.ts:29-37`).

- `status:'running'` is emitted **once**, before the run starts (`routes/team-channels.ts:674-677`).
- `activity` re-broadcasts a whole `running` frame **once per `setActivity()` call**, unthrottled and
  un-batched (`routes/team-channels.ts:719-723`; the emitter is one tracer event per non-blank
  activity, `session-manager.ts:2124-2133`).
- `status:'done'|'error'` on completion (`:744-752`, `:763-766`).

**Not carried, and therefore unrenderable no matter what the client does:**

| a UI would want | can it? | why |
|---|---|---|
| elapsed time | ✗ | no start timestamp in any frame; the client can only time from the frame it happened to receive |
| step N of M | ✗ | no step identity, no count |
| which sub-agent is working | ✗ | `activity` is one opaque string; `/chat` gets a node tree (`chat/app/tree.tsx:18-104`) and per-node chips (`ActivityStrip.tsx:12-62`) |
| a history of what it did | ✗ | `activity` is overwritten, never accumulated, and **never persisted to the row** — a client that opens the channel mid-turn sees nothing at all |
| "waiting for a human" | ✗ | no such status — see B4 |
| cost / budget | ✗ | not in the union; `/chat` has both (`ChatView.tsx:216-220`, `BudgetWindows.tsx:22-84`) |
| cancel the turn | ✗ | no client→server frame for it (and `/chat` has no stop button either, so this is a whole-product gap, not a team one) |

**Two cheap, high-value protocol additions**, in order:

1. `startedAt` (ISO) on the `running` frame → the client can render a live elapsed ticker with no
   further changes. One field.
2. A `'waiting'` status (B4) → the difference between "still thinking" and "waiting on you".

A third, larger one: persist the last activity string on a placeholder row, so a client joining
mid-turn learns a turn is in flight. That needs the message-update frame from B1.

### B3 · ✅ verified sound · `blocks` preserve enough structure to render

This one is **fine and should not be touched.** The channel stores THING's answer as real descriptors,
not source:

- `renderResult` (`routes/team-channels.ts:961-1009`) keeps descriptors as `blocks` after
  `sanitizeDescriptor`, flattens prose into `text`, and preserves reading order by wrapping a bare
  string as a `Paragraph` (`:986`). It prefers **every** `display()` of the turn over the single
  `result` (`:965`), so a heading-then-table answer stores both.
- The old "posted the agent's own TypeScript" bug is closed at the right layer: there is no fallback
  to the turn's source, and a silent turn posts the sentence
  `'THING finished without posting an answer.'` (`:1001-1007`).
- The client renders `blocks` through the **same** `renderDescriptor` the `/chat` transcript uses
  (`messages.tsx:13, :171` → `chat/components/render-descriptor.tsx:34-203`), which knows ~40
  descriptor types, and recovers a descriptor that was serialized en route via
  `toRenderableDescriptor` (`messages.tsx:168`, `render-descriptor.tsx:213-218`) so pre-`blocks`
  threads still render.

**One consequence worth knowing.** Because `renderResult` concatenates every display of the turn into
a *single* message, a long build posts one very large message with no internal structure the
transcript can collapse. `/chat` gets the same content as N separate blocks it can attribute and
collapse individually (`chat/store/model.ts:254-257`). If channel answers start reading as walls,
this is the reason — the fix is N rows, not a taller row, which again needs the message-update frame
(B1) or a per-display append.

### B4 · S1 · defect · The shape of a parked ask is not expressible to a client

**What is stored and sent when THING asks the thread a question:** an ordinary `kind:'thing'` message
row, and nothing else.

```
routes/team-channels.ts:688-693   // on 'ask_start': pendingAsks.set(key, {renderHost, askId}); postAsk(...); onParked()
routes/team-channels.ts:830-849   // postAsk → appendMessage({kind:'thing', ...renderResult(descriptor), threadId, mentions:[asker]})
```

Four separate consequences:

1. **The row carries no ask identity and no ask marker.** `ChannelMessage`
   (`server/team-channels.ts:81-128`) has no `askId`, no `kind:'ask'`, nothing. A client cannot tell a
   question from an answer *even in principle*, which is why A6 is blocked on this.
2. **No status transition is broadcast on park.** `onParked()` only releases the shutdown-drain
   promise (`:693`, `beginThingReply:580-590`). The last frame a client saw was `status:'running'`
   (`:674-677`), so the busy indicator runs forever while THING is in fact waiting for a human.
3. **Any reply resolves it, silently.** Every message in a thread with a pending ask is offered to
   `answerPendingAsk` *before* anything else, and the raw text is submitted as the answer with no
   interpretation (`:559`, `:808-815`). Two people in a thread — one answers, the other says "brb"
   first — and "brb" is the answer. No confirmation row is posted; the asker cannot tell what was
   submitted.
4. **No timeout; the session leaks.** `pendingAsks` is a plain `Map` with no TTL (`:794`). An
   unanswered ask holds a suspended session for the pod's lifetime — acknowledged as an accepted risk
   at `:782-786` and `design/thing-thread-parity-progress.md:22-25`.

**Proposed protocol shape.** `ask: { id }` on the row (or `kind:'ask'`), a `thing_status:'waiting'`
frame on park, a dedicated `POST /api/team/channels/:id/asks/:askId` for the answer, and a small
system row on resolution naming who answered and with what. That last one is what makes the
"any reply is the answer" behaviour honest rather than spooky — keep the fallback, just say so.

**Not yet proven end to end.** `design/thing-thread-parity-progress.md:53-57` states S1–S7 are
unit-green but "**Not yet exercised against a real pod**". Every claim above is read from code.

### B5 · S2 · gap · What the app card carries, and what it misses

**Carried.** `announceNewApps` (`routes/team-channels.ts:899-945`) does three things on a successful
turn: pins the app to the channel and broadcasts `{type:'channel'}` (`:915-916`); appends a
`kind:'system'` row with `text: "<name> is ready."` and `app: {projectId, name}`
(`:920-926`, field declared at `server/team-channels.ts:125`); and broadcasts
`{type:'app_created', channelId, threadId, projectId, name, requestedBy?}` (`:928-938`). The client
renders the row as a card with an **Open** button (`messages.tsx:249-292`) and auto-opens the rail for
the asker only (`channels-view.tsx:128-144`). **This is the best-designed part of the surface and is
the right template for every future "THING did a thing" receipt** — see B13.

**What it misses.**

- **Detection is "a project gained a `pages/` directory during this turn"** (`:682`, `:907-909`,
  `projectHasApp:864-870`). THING *improving* an existing app produces no card, no pin and no event —
  which is most turns after the first.
- **The whole function is wrapped in a swallowing catch** (`:940-944`). A `patchChannel` failure drops
  the card, the pin and the event with zero surfacing anywhere.
- **The card carries no version, no summary of what changed, and no link to the turn.**
- The client's auto-open resolves the asker by finding the root message *in the loaded transcript*
  (`channels-view.tsx:138-139`); with the 50-message window (A9/B10) that lookup returns undefined on
  a busy channel and the app silently does not open for the person who asked.

### B6 · S2 · defect · Error text is posted as a raw message, and the crash path drops the badge

**What is stored.** Both failure paths flatten the error into a `kind:'system'` row's `text`:

```
routes/team-channels.ts:728   text: `THING could not answer: ${result.error ?? 'unknown error'}`   // agent-reported
routes/team-channels.ts:759   text: `THING could not answer: ${err instanceof Error ? err.message : String(err)}`  // thrown
```

Three problems, all at this layer:

1. **Nothing marks it as an error.** It is the same `kind:'system'` as `"Rota is ready."`, so the
   client's only way to style it differently is string-matching the prefix. A6/A5 need a real signal —
   `kind:'error'`, or `error: true` on the row.
2. **The raw JS exception message is shown to a non-engineer.** `Cannot read properties of undefined
   (reading 'columns')` is what a user reads. The row should carry both: a human lead line and the raw
   detail in a separate field the client can put behind a disclosure.
3. **The catch path drops the `mentions` stamp.** Compare `:740` (agent-reported failure — stamps
   `mentions:[message.userId]`) with `:756-761` (thrown exception — no `mentions`, and no `sessionId`
   either). So when a turn crashes *hard*, the person who asked is never badged and never pushed. This
   is a one-line asymmetry with a real consequence: the louder the failure, the quieter the
   notification.

There is also **no retry path at any level** — no endpoint, no stored prompt to re-run. The client
cannot offer a Retry (A5) until one exists. The prompt is reconstructible from the root message
(`promptFor`, `server/team-channels.ts:524-527`), so this is cheap.

### B7 · S2 · gap · Attachments: the whitelist shipped, nothing else did

**Confirmed.** `POST /api/uploads` is whitelisted for a team **viewer** with the reason written into
the code — and asserted by a test:

```
sdk/org/libs/cli/src/server/team-guard.ts:84
  { method: 'POST', path: /^\/api\/uploads$/, why: 'attach a file to a message' },
sdk/org/libs/cli/src/server/team-guard.test.ts:113
  ['POST', '/api/uploads', 'attach a file'],
```

**What the rest of the stack actually assumes.** The upload machinery is real and complete, but it is
built around a **session**, not a **message**:

- `POST /api/uploads` stores bytes + meta and returns an `AttachmentRef` (`routes/uploads.ts:16-45`,
  `server/uploads.ts:239-257`), transcribing audio on the way in (`session-manager.ts:1634`).
- The ref is then held by the *chat composer* and sent with the **next agent message**
  (`chat/store/model.ts:3`, `chat/app/Composer.tsx:151-186`), assembled into model parts on the
  session WS path (`server/ws/agent.ts:88` → `assembleParts`, `server/uploads.ts:372`).
- **Nothing between an upload and a channel message exists.** `ChannelMessage`
  (`server/team-channels.ts:81-128`) has no attachment field. `handlePostMessage` parses only
  `{text, threadId}` (`routes/team-channels.ts:518-519`). `sdk/org/libs/ui/src/team/composer.tsx` has
  no attach control, no mic, no file input.
- **THING cannot receive one even if it were carried.** The channel turn's prompt is a **plain
  string**: `promptFor` returns `` `[${who} in #${channelId}] ${stripMention(text)}` ``
  (`server/team-channels.ts:524-527`), passed as `message:` to `runHeadlessThreaded`
  (`routes/team-channels.ts:705-724`). There is no parts/attachments parameter on that path at all —
  so the whole vision/audio/file capability is structurally unreachable from a channel.

**And a live privacy hole the whitelist implies but does not cover.** `GET /api/uploads/:id` serves
raw bytes with **no ownership or audience check whatsoever** — it takes the id and returns the file
(`routes/uploads.ts:48-62`). On a personal pod that is correct (one user). On a **team** pod it is
not: `GET` is unconditionally allowed by `READ_ONLY_METHODS` (`team-guard.ts:93`), so *any* member —
including a viewer — can fetch *any* upload on the pod by id, including one attached to a DM they are
not part of, or one a colleague uploaded in a private conversation with THING. Ids are random so they
cannot be guessed, but they will appear in URLs, in `blocks`, in push payloads and in anything
copy-pasted. Today nothing in the team surface produces such a URL, which is the only reason this is
not already exploitable — **the moment attachments ship, it is.**

**So "add attachments to channels" is five things, not one:**

1. `attachments?: AttachmentRef[]` on `ChannelMessage`, accepted by `POST …/messages`.
2. An **audience check on `GET /api/uploads/:id`** in team mode — the upload has to record which
   channel/message it belongs to, and the read has to run the same `requireVisibleChannel` test the
   message does. Do this **before** shipping any producer.
3. A token-in-URL story: `<img>`/`<audio>` cannot send a bearer header, which is why `/chat` uses
   `withAuthToken` (`chat/app/Message.tsx:160`). The team client has that pattern only for the socket
   (`libs/ui/src/team/client.ts:102-110`) and would need it for media too.
4. A decision on whether an attachment reaches THING — which means `runHeadlessThreaded` accepting
   parts rather than a string, i.e. changing `promptFor`'s contract.
5. Only then the composer UI (Part A).

Until (2) lands, I would **remove or comment the `why: 'attach a file to a message'` line** so the
next reader does not take the whitelist as evidence the feature is safe to finish.

### B8 · S2 · defect · Ordering and idempotency have no key

- **Ordering.** The only time field is `ts`, an ISO string stamped just before an **unserialized**
  `appendFile` (`server/team-channels.ts:419-423`); there is no per-channel lock anywhere in that
  file. Reads return **physical file order with no sort** (`readMessages`, `:448-496`). So under
  concurrency the file order and the `ts` order can diverge, and there is no tie-break to reconcile
  them. The client compounds it by appending in socket-arrival order and never sorting
  (`use-team-chat.ts:193`), so two clients can render two different orders and a reload can render a
  third.
- **Idempotency.** `handlePostMessage` reads only `{text, threadId}` (`routes/team-channels.ts:518-519`)
  and mints a fresh `randomUUID()` per call (`server/team-channels.ts:418`). `appendMessage` *accepts*
  an optional `id`/`ts` override (`:412-414`) but no route ever passes one. A client retry after a
  timeout stores a duplicate, and there is no dedup anywhere.

**Fix.** A monotonic per-channel sequence on the row, ordered by on read; and accept a
client-supplied `clientId` on POST, returning the existing row on a repeat.

### B9 · S2 · defect · Read state is derived from a file mtime, so watching a channel does not read it

**What exists.** `.team/reads.json`, `userId → channelId → {readAt, mentions}`
(`server/team-reads.ts:4-6, 36-44`). `mentions` is an exact maintained counter (`addMentions:114-132`,
zeroed in `markRead:93-104`). **`hasUnread` is not stored** — it is derived as
`lastActivityAt(channel) > readAt`, where `lastActivityAt` is the **channel log file's mtime**
(`team-reads.ts:83-90`, used by `unreadFor:155-174`).

**The consequence.** The client calls `markRead` only when a channel is *opened*
(`use-team-chat.ts:164`). Every message that arrives while the member sits watching moves the file's
mtime past their `readAt`, so the channel is unread again on the next visit and on every other
device. Their own posts are exempt because posting marks read (`routes/team-channels.ts:635`) —
which is exactly why this is easy to miss in testing: it only shows when *someone else* is talking.

**Fix.** Either re-issue `markRead` (debounced) from the client while the channel is on screen — the
smaller change — or store a real last-read message id and compare ids rather than mtimes, which also
gives you the "new messages since" divider (A14) for free.

### B10 · S3 · defect · A stale pagination cursor silently resets to the newest page

`readMessages` stops early when a line's id matches `opts.before`; if `before` never matches, the
`reachedBefore` flag is **explicitly discarded** (`void reachedBefore`,
`server/team-channels.ts:494`) and the function falls through to returning the newest window as if
`before` had not been given — while still reporting `hasMore: true` (`:480-483`). A client
paginating with a cursor that has aged out of the log therefore gets silently teleported to the top
of the conversation and told there is more. Latent today only because nothing paginates (A9) — it
will bite whoever fixes A9.

### B11 · S2 · gap · Consent-gated capabilities fail closed, and the failure is unattributed

The channel turn deliberately passes `visibleToUser: true` and **not** `interactive`, because
`interactive` also grants the consent prompter and a channel has no client that can answer it
(`routes/team-channels.ts:713-715`). Headless runs then fail closed. Documented at
`org/docs/cli-api/rest/team.md:343-346` and `design/teams-handoff.md:73-78`.

From a user's seat this is indistinguishable from a bug: a request that works in `/chat` fails in a
channel with a generic "THING could not answer". **Short-term fix at this layer:** detect a
consent-shaped failure and post a specific message ("THING needs your approval to use `<X>`, which
channels can't ask for yet — try this in Chat"). **Long-term:** the ask card from B4 *is* the client
a consent prompt needs; once it exists, wiring the prompter to it is the natural follow-up, and B4
should be designed with that in mind (the descriptor a consent prompt sends is already renderable —
`ConsentCard`/`isConsentDescriptor`, `chat/components/ConsentCard.tsx:24-26, :65-125`).

### B12 · S3 · defect · A viewer's own message and THING's reply are not distinguishable by capability

Minor but worth knowing while designing B13: `VIEWER_ALLOWED` (`team-guard.ts:67-90`) lets a viewer
post to a channel, open a DM, set their handle, run a session and drive it. So *any* member can make
THING act. Whatever `team:*` grants, it grants to viewers too unless the globals check the caller's
role — and the channel turn currently runs with **no caller at all** (see B13).

---

## B13 · The design note you asked for: `team:*` globals and what the conversation needs

*You are adding team-only globals to THING: read the directory, list channels, post into another
channel, DM a member, read a channel's history. Here is what the surface needs in order for those to
be legible to a person, and the two modelling questions I think have to be answered first.*

### The two things to decide before any of it

**1. Whose authority does THING act with?** Today a channel turn has **no caller**. `runThingReply`
runs headless (`routes/team-channels.ts:664-724`); the asking member's identity survives only as prose
inside the prompt string (`promptFor` → `` `[${who} in #${channelId}] …` ``,
`server/team-channels.ts:524-527`) and as a `mentions` stamp on the reply (`:740`). Meanwhile every
human write is gated on the verified caller: `requireVisibleChannel` decides whether you may even see
a DM (`:531`), and `audienceFor` decides who receives its events (`ws/team-channels.ts:154-156`).

So a `team:readChannel` global that ignores the asker is a **privilege-escalation path**: a viewer
asks THING "what did Ana and Bo say to each other" and THING, running with no identity, can read a DM
the asker cannot open. The globals must carry the asking member's id and re-run the *same*
`requireVisibleChannel` test, not a weaker one. This is the highest-risk item on the list, and it is
invisible in the UI — which is why it belongs in the design, not in review.

**2. What is THING's identity when it writes?** A message row's author is stamped from the verified
caller (`:530, :541`); a `kind:'thing'` row has **no `userId` at all**
(`server/team-channels.ts:103`), and the client renders it as a bare "THING" with a ✦ avatar
(`messages.tsx:189-210, :235`). There is currently **no way to express "THING, on behalf of Ana"**.

The DM case makes this sharp. `dmChannelId` hashes a *sorted set of user ids*
(`server/team-channels.ts:292`) — there is no THING user id to put in one. So `team:dm(member, text)`
has to choose:

- **DM as the asker** → impersonation. The recipient reads it as Ana's own words. I would not ship
  this.
- **DM as THING** → needs a reserved pseudo-user id in the DM member set, a directory entry for it,
  and `dmPartner`/`channelTitle` (`format.ts:38-55`) to understand it. Tractable, but it is a data-model
  change, not a global.
- **Post into the existing thread and @-mention the person instead** → no new identity, no new
  channel, uses the badge/push machinery that already works (`deliver`, `routes/team-channels.ts:629-652`).
  **This is the cheapest correct v1** and I would start here.

### What the conversation needs, concretely

**(a) A receipt in the thread where the request was made.** If THING posts in `#ops` because you
asked in `#general`, the `#general` thread must say so — otherwise the asker has no evidence anything
happened, and the only proof is in a channel they may not have open.

The pattern already exists and works: the app card is a typed field on the row (`app: {projectId,
name}`, `server/team-channels.ts:125`) rendered as a card with an action
(`messages.tsx:249-292`), announced with its own socket frame (`app_created`,
`ws/team-channels.ts:52-59`). **Copy it exactly:** a `postedTo: {channelId, channelName, messageId}`
field, an `ActionCard` component, and a jump. Web already has the destination in the URL
(`?channel=&thread=` — `routes/team/$teamId/channels.tsx:116-120`), so the deep link is free.

**(b) Attribution on the message THING writes elsewhere.** Readers of `#ops` will see an agent
message appear with no explanation. The row needs `onBehalfOf: { userId }`, rendered in
`MessageHeader` (`messages.tsx:219-240`) as **"THING · for Ana"**. Two things follow from getting
this right: the people `#ops` cares about get badged (`mentionAudience`, `routes/team-channels.ts:630`)
rather than the asker, and an audit of "who caused this" is possible at all.

**(c) A visible account of what THING *read*.** `promptFor` shows THING one line today. Give it
`team:readChannel` and it can suddenly quote something said three weeks ago in a channel the current
reader does not have open — and the reader has no way to know where it came from. `/chat` answers this
with attribution links into the DevPanel (`chat/app/Message.tsx:109-121`); a channel has nothing.
**Minimum viable:** a collapsed chip on the answer — "read 40 messages from #ops" — expandable to the
range. Without it, THING quoting private-feeling context reads as surveillance rather than help.

**(d) Consent, or an honest substitute.** These globals mutate other people's surfaces. That is
exactly the class of action `@consent` exists for — and the channel turn deliberately has no consent
prompter (B11). So either these are auto-approved and the receipt card in (a) is the **only**
accountability that exists, or B4's ask card lands first and consent rides on it. I would sequence
**B4 → `team:post`/`team:dm`**, and ship the read-only globals (`directory`, `listChannels`,
`readChannel`) ahead of the write ones, since they need only (c) and the authority check.

**(e) Budget the reads.** `readMessages` caps at 200 (`server/team-channels.ts:453`). A
`team:readChannel` that returns 200 messages into the model's context is a token bomb and will make
channel turns slow and expensive in a way nobody can see. Cap it lower at the global (25–50), make
the range explicit in the return value, and surface it in (c).

**(f) One thing that will bite immediately.** A message THING writes into another channel must go out
with `audienceFor(thatChannel)` (`ws/team-channels.ts:154-156`) and must run `deliver()`
(`routes/team-channels.ts:629-652`) for badges and push — neither of which happens automatically
outside `runThingReply`'s own hand-written append+broadcast (`:730-743`). Writing a message row
without those is how a DM leaks to every socket in the team.

---

# Part C — boundary cases

*Cause is protocol-shaped; code lives in `sdk/org/libs/ui/src/team/use-team-chat.ts`, which Part A
owns. **Coordinate before either side edits this file.***

### C1 · S1 · defect · A dead socket silently swallows your own messages

**What a user sees.** Laptop sleeps, wifi blips, or the pod restarts. The channel goes quiet forever
and every message they send clears the composer and then *does not appear*. Nothing says anything is
wrong; the only recovery is a reload they have no reason to attempt.

**Cause, three parts.**

1. `send` posts and discards the returned message — there is no optimistic insert
   (`use-team-chat.ts:281-287`); the transcript grows **only** from the WS `message` frame (`:191-193`).
   The server does echo to the sender (`message` broadcasts pass no `exclude`,
   `routes/team-channels.ts:547`, cf. `ws/team-channels.ts:118` where `typing` does), so this works
   while the socket is up and fails totally when it is not.
2. The socket has **no reconnect and no error surface**: the whole lifecycle is
   `use-team-chat.ts:177-279` — no `onclose`, no `onerror`, no backoff. A constructor throw is
   swallowed outright (`catch { return }`, `:262-266`).
3. There is no connection indicator anywhere on the surface; `/chat` has one
   (`chat/app/ChatView.tsx:24-43`).

**Fix.** (a) Insert the message returned by `postMessage` immediately — the WS dedupe at `:193`
(`prev.some(m => m.id === incoming.id)`) already makes the echo idempotent, so this is a one-line
change with no double-render risk. (b) `onclose`/`onerror` → backoff reconnect, re-fetching the
active channel's history on reconnect. (c) Surface the state with the `/chat` connection dot. Note
B1: there is no resume cursor, so (b) can only re-fetch, not replay.

### C2 · S2 · defect · A failed send is silent

`Composer.submit` restores the draft on throw and swallows the error (`composer.tsx:191-198`), and
`send` is the one action in the hook that never calls `fail(err)` (compare `use-team-chat.ts:281-287`
with `createChannel:289-303`, `patchChannel:332-342`, `openDm:344-356`). So `chat.error` — and the
error bar at `channels-view.tsx:234-249` — never fires for the most common failure on the surface.
Fix: `catch (err) { fail(err); throw err }`, and keep the failed text as a retryable pending message
rather than a silently restored draft.

### C3 · S2 · defect · A message can be lost when a channel is opened

The history effect clears the transcript, awaits the fetch, then **overwrites** it
(`use-team-chat.ts:151-155`). A `message` frame arriving in that window is applied to state that is
then replaced by the fetch result. Fix: merge the history response into existing state rather than
replacing it. (The ordering half of this is B8.)

### C4 · S3 · defect · Unbounded client state

`thing_status` frames are applied without checking `parsed.channelId` (`use-team-chat.ts:216-230`),
and `messages` retains every channel visited this session, filtered only at render (`:389-392`).
Harmless today — thread ids are unique message ids — but both maps grow for the tab's lifetime.

### C5 · S3 · polish · The typing throttle is global, not per-channel

`lastTypingSent` is a single ref (`use-team-chat.ts:98, :372-383`), so switching channels within
2.5s suppresses the first typing frame in the new one.

---

# What I could NOT determine by reading

1. **How bad A1 actually feels.** The mechanism is certain; perceived severity depends on render
   frequency. *Settle it:* the scripted shot in A1's pass condition, or a render counter on `Scroll`.
2. **Whether A1 reproduces on native.** The native fork pins on `onContentSizeChange`
   (`scroll/index.native.tsx:72`), which fires on content growth rather than on every render, so it
   may be materially less aggressive. *Settle it:* a native render assertion or a device run.
3. **The composer's real keyboard behaviour on a device.** No remount hazard exists in the JSX I read,
   but per this repo's own history a parent-identity change is what kills a `TextInput`, and only a
   device proves it. *Settle it:* type a long message while a colleague types (typing frames re-render
   the tree) and confirm the keyboard survives and the caret does not jump.
4. **Whether the `ask()`-in-a-thread path works end to end at all.**
   `design/thing-thread-parity-progress.md:53-57` — S1–S7 unit-green, "**Not yet exercised against a
   real pod**". Every B4 claim is read from code.
5. **How a real multi-display THING turn reads as one message** (B3's consequence). *Settle it:* a
   live build in a channel, screenshotted.
6. **Whether `useMedia().gtMd` reports correctly at 390px on native** (`use-layout.ts:25-32`) — the
   whole compact branch depends on it, and jsdom cannot see the native target.
7. **Measured tap-target boxes** (A8). 36px is derived from `$9` × a 4px unit
   (`tokens.generated.ts:560-561`), not measured from a rendered element.
8. **Real ordering behaviour under concurrency** (B8). *Settle it:* two clients posting into one
   channel in a tight loop, then compare transcripts and reload order.
9. **`settings.tsx` compact layout** (513 lines incl. embedded Stripe) — read only through line 120.
10. **Multi-member behaviour generally.** Every finding involving a second person (B4's "somebody
    else's reply becomes the answer", B9, presence) was reasoned from code with one reader. A
    two-account live session would confirm or kill several of them quickly.

---

# Suggested sequencing

**Part A (UI session), in impact order:** A1 → A2 → A3 → A4 → A9 → A5* → A7 → A12 → A8 → A10 → the
S3 tail. *(A5 and A6 are starred/blocked: they need B6 and B4 respectively to give the client
something to branch on.)*

**Part B (coordinator), in impact order:**

1. **B7 step 2** — the `GET /api/uploads/:id` audience check. Smallest item on the list, and the only
   one that is a live security gap the moment anything else ships.
2. **B6** — mark errors as errors, split human lead from raw detail, restore the missing `mentions`
   stamp on the crash path. Unblocks A5.
3. **B4** — the ask's shape: `askId` on the row, a `waiting` status, a resolution endpoint and a
   resolution receipt. Unblocks A6, and is the prerequisite for consent (B11) and for the write half
   of B13.
4. **B2's one field** — `startedAt` on the `running` frame, so elapsed time becomes renderable.
5. **B9** — read state, ideally via a last-read message id (which also gives A14 its divider).
6. **B8** — an ordering key and a client idempotency key.
7. **B1's message-update frame** — the single highest-leverage protocol addition; unblocks progressive
   answers, edit, delete and reactions.
8. **B13** — `team:*`, sequenced read-only-first, with the receipt card and `onBehalfOf` landing in
   the same change as the first write global.
