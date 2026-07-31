# Team + chat UI/UX pass

Started 2026-07-31. (Root `PROGRESS.md` is held by the app-builder-v2 work, so this
lives here — same convention as `design/thing-thread-parity-progress.md`.)

Goal, from the owner: discover and land UI/UX improvements across the **team** and
**chat** surfaces; everything must work on **mobile**; **screenshots are the final
gate** on every change.

## The gate

`pnpm shots` — `apps/web/tests/surface-shots/`. Builds a Vite harness that mounts
the REAL surfaces and photographs them at a phone (390×844) and a desktop
(1440×900) viewport, in both themes.

It works because both surfaces already have a clean injection seam:
`TeamChannelsView` takes `client: TeamClient` (so an in-memory client drives the
whole thing), and the chat store is plain Zustand (so a seeded transcript renders
`ChatView` with no socket).

Why a picture and not an assertion: **every other gate in this repo is blind to
layout.** `renderToStaticMarkup` + jsdom cannot see a container that collapsed to
zero height, the a11y tree lists content that is painted nowhere, and the Metro
graph gate proves modules RESOLVE, not that they mount. A surface can be blank
with the whole suite green — that has happened here before.

The shooter does fail the build on the few things a machine CAN judge: a collapsed
stage, a surface with no painted boxes or no text, and horizontal overflow at
phone width.

## Status

- [x] Screenshot gate built and producing readable pictures of both surfaces
- [x] Discovery — 3 parallel audits (team: 23 findings, chat: 19, mobile: 18)
- [x] Triage into a ranked work list
- [x] Implement — team / chat / mobile agents, plus the shared layer here
- [x] Gates all green: `pnpm typecheck` (8/8) · `libs/ui` 587 tests / 74 files ·
      `pnpm test:native` PASS · `pnpm lint:tokens` 741 files · `pnpm shots` ·
      `docs:check` 5262 citations

**One pre-existing failure, not from this work.**
`libs/core/src/typecheck/library-dts.test.ts` fails: the registry now holds 12
capability fragments and the test expects 10. Introduced by a CONCURRENT
session's commit `39a1e436` ("team: THING can see the team it is working for —
team:read and team:post"), which is already an ancestor of HEAD with no working
-tree changes in `libs/core`. That session is committing every few minutes in
exactly this area, so it has been left alone rather than fixed underneath them.

**Not verified on a device.** Nothing in the mobile pass ran on a simulator or a
phone — there is neither here. The Metro gate proves modules RESOLVE, the render
suites prove they MOUNT, and the screenshots are a headless browser at phone
dimensions, not a phone.

## Done in the shared layer (this session, directly)

**1. Every markdown list in the web app had no bullets and no numbers.**
`markdown/render.tsx` deliberately left web "on the browser's own native
marker" — but `preflight.css:96` resets `list-style: none` on every `ol`/`ul`,
so there was no marker to inherit. A numbered list read as four unlabelled
indented lines, everywhere `display()` produces one: the chat transcript, team
messages, docs content. Fixed via `style` (a `listStyleType` PROP is dropped —
`list-style` has no RN equivalent so it is not in Tamagui's prop set).
Nothing could have caught this: the text is all in the DOM and in the a11y
tree, and jsdom has no marker box to measure. **A screenshot caught it.**
Test: `elements/content/markdown/index.test.tsx`.

**2. A short transcript floated at the top with a void above the composer.**
`stickToEnd` could only ever SCROLL, and there is nothing to scroll when the
content is shorter than the box. Fixed in the `Scroll` primitive with a growing
spacer above the content — deliberately NOT `justify-content: flex-end`, which
makes overflow unreachable in the start direction ("cannot scroll back to the
first message"). `shoot.mjs` now proves that reachability on a deliberately
overflowing `team-long` fixture at both viewports.

**3. `stickToEnd` regions computed to `display: block`.** So both the new spacer
and any `gap` the caller passed were inert — the team transcript was already
asking for `flexDirection="column" gap="$4"` and silently getting neither. The
group spacing it wanted appeared the moment this was fixed.

**4. `libs/ui`'s vitest config never included `src/team/**`.** There was nowhere
for a team test to run and, unsurprisingly, not one had ever been written — the
whole surface (transcript, threads, composer, `@` picker, sidebar, unread, rail)
ships with no suite. Any test added there would have passed by never running.
The same file's comments record this exact bug happening twice before, for
`chat/`. Added; the team agent was told, since its tests were about to vanish.

**5. The design-token gate did not catch bare colour keywords.** It checks hex,
`rgb()/hsl()` and the stock Tailwind palette — so `color="red"` sailed through
and shipped in the chat surface's required-field asterisk with `pnpm
lint:tokens` green the whole time. Added a `raw-color-keyword` rule (colour-
carrying props only, so the words themselves stay safe in prose and in
identifiers like `whiteSpace`). Three real hits, all now fixed or escaped:
`AskBlock` (`color="red"`), `studio/space/user-detail-panel` (`color="white"`
on a `$agent` chip → `$agent-foreground`), `studio/space/space-list`
(`borderColor="white"` on a status ring → `$background`; a white ring was wrong
in dark mode anyway). 8 new linter tests, most of them in the false-positive
direction — a rule that cries wolf gets escaped everywhere and then catches
nothing.

**Correction to the team audit:** it reported the three `rgba(0,0,0,…)` uses as
violations of a hard gate. They are not — the linter explicitly ALLOWS
achromatic overlays/scrims/shadows. Moving them to `color-mix` is still an
improvement, but the gate was never failing on them.

## Finished in the shared layer after the agents landed

- **Chat transcript bottom-anchored.** Its inner column asks for
  `minHeight: 100%` so the empty state can fill and centre, which left `Scroll`
  no free space to give its spacer — so the anchoring goes on that column
  instead, gated on there being a conversation (the empty state stays centred).
  Safe there specifically: it is not the scrolling box, so end-alignment cannot
  make the overflow unreachable.
- **`onScroll` never reached native.** `nativeSafeProps` drops any `on*` prop it
  does not know, so every caller's `atBottom` was frozen at its initial value on
  a phone and follow-mode degraded to "always pinned" — a reader who scrolled up
  to reread something got dragged back down by the next token, with no way to
  stay put. Fixed in the `Scroll` fork, which now also TRANSLATES the event:
  React Native reports the same three numbers as `e.nativeEvent.contentOffset/
  layoutMeasurement/contentSize`, so the caller keeps writing the web idiom once
  and both targets honour it. Same bargain `stickToEnd` already makes.
- **A bug in my own first attempt**, caught by the native suite: the anchoring
  style was ASSIGNED over the content's resolved style rather than merged into
  it, which silently deleted a transcript's padding and its gap between messages
  the moment bottom-anchoring was asked for. Now merged, with a test.
- **A test that was weaker than it looked.** `findByType(NATIVE_VIEW)` returns
  RN's OWN content-container View on Android, so an assertion written against
  "the first View" passed on iOS and failed on Android for identical correct
  code. The new tests search all Views instead.
- **`chat/components/ui/**` was outside the vitest include** (single-level glob),
  so `Drawer.test.tsx` had to be exiled to the parent directory to run at all.
- **`design-system/README.md` said "`lm-*` is sanctioned; don't churn it."**
  True while the chat surface was web-only; actively misleading now. Rewritten
  to say why the aliases vanish on native and which files must use shared tokens.

## The gate earned itself mid-session

While the team agent was adding its jump-to-bottom button it wrapped both
transcripts in `<Prim.Box position="relative" flex={1} minHeight={0}>` to host
the absolutely-positioned control. `Prim.Box` computes to **`display: block`**,
so the `Scroll` inside it kept `flex={1} minHeight={0}` — which means nothing in
a block parent — and sized to its CONTENT: 3804px of transcript in an 844px
phone window, `clientHeight === scrollHeight`, no scrolling at all, composer
painted over the last message, newest messages unreachable.

Every automated gate stayed green. It was caught by looking at a picture.

`shoot.mjs` now checks for it directly: the page must not scroll (these are
fixed-height shells) and no `overflow-y: auto` region may be taller than the
viewport. Both fire on the regression today, so it cannot come back silently.

## Landed by the agents

**Mobile** (`apps/mobile/**`): team/invitation taps on Home did nothing at all
(no `onOpenTeam`, and the web fallback no-ops on RN); Android back did not close
a full-screen app; push notifications carried a deep-link URL the app never
read; there was no way to sign out (and signing out now unsubscribes push FIRST,
while the token still exists — a privacy bug, not tidiness); pod-start failure
had no retry; `TeamScreen`'s loading and error states were dead ends; tap targets
32→48pt; spinners; `AppState` refresh on foreground; orientation `portrait` →
`default`. Gates: mobile `tsc` clean, 20/20 unit tests, `test:native` green.
NOT run on a device or simulator — there is neither here.

**Team** (`libs/ui/src/team/**`): the empty-state flash on every channel switch;
the socket never reconnecting (now backoff, mirroring `chat/store/ws-client.ts`,
with a visible "Reconnecting…"); drafts bleeding between channels and threads
(the wrong-channel-send risk); sends that were neither optimistic nor reported
on failure; delete/remove/leave with no confirmation; a stale `meId` that could
stop the requester's app opening; rail width not surviving close/reopen; a dead
`'Channels' : 'Channels'` ternary; three `rgba()` → `color-mix`; jump-to-bottom
on both transcripts; a 44px unpin target; web-gated autofocus; mentions after
punctuation; URL auto-linking; a 90s safety timeout so "THING is working…"
cannot hang forever; absolute timestamps; long-press feedback.
7/7 tests — **the first this surface has ever had.**

Deliberately not built, and I agree with the call: the unread divider. The
server sends only a boolean `hasUnread`, no per-message read cursor, and a
client-side guess would be wrong often enough to be worse than nothing.

## Traps hit

- `libs/core/dist/ui/` was EMPTY (a build wiped it mid-session), which fails the
  Metro gate with `Unable to resolve @lmthing/core/ui` pointing at a file that
  had not changed. `pnpm --filter @lmthing/core build` restores it. The
  workspace-link guard passes throughout, so it does not point at this.
- The picture gate must settle animations at their END, not `currentTime = 0`
  the way `visual-surface/capture.mjs` does. Frozen at 0 a fading-in transcript
  photographs as invisible, which reads as a contrast bug that is not there.
- **A concurrent session committed mid-run** (`7852320d`) and swept the team
  agent's 47-line edit to `org/docs/cli-api/rest/team.md` into ITS commit. The
  agent, seeing `git status` clean for a file it had just written, concluded
  `assume-unchanged` was set on all 130 docs. It is not — `git ls-files -v`
  shows zero. Nothing was lost, but the diagnosis would have sent the next
  person chasing a git bit that does not exist. Commit with
  `git commit --only <paths>` here, always.
