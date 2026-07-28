# Teams on a phone — review, plan, progress

Written 2026-07-28, from a live run of the team surface at 390×844 (iPhone-12-class) against a local
team pod. The surface is `@lmthing/ui/team` plus its two hosts: `apps/web/src/routes/team/**` and
`apps/mobile/src/TeamScreen.tsx`. Everything in the shared package lands on BOTH targets, which is
why almost every fix below belongs there rather than in a host.

> The one thing to know before reading: **on a phone the native app's Teams tab is the channels view
> and nothing else.** `TeamScreen` renders `TeamChannelsView`, silently picks `teams[0]`, and offers
> no members, settings, projects, invites or team switcher. The web surface has all five as tabs —
> and at 390px four of them are off the right edge of the screen. So "teams on a phone" is missing
> most of the product on one target and hiding it on the other.

## How this was reviewed

A local rig plays Envoy and the gateway in front of a real team pod (`reference-local-team-pod-rig`),
the web app runs from Vite with `VITE_CLOUD_BASE_URL` / `VITE_COMPUTER_BASE_URL` pointed at it, and
screenshots come from a headless Chrome at 390×844 (`scratchpad/shot.mjs`). Every finding below was
seen, not inferred; every fix is re-screenshotted at the same size.

## Findings

### Blocking — the surface does not fit, and half of it cannot be reached

| # | What | Where |
|---|---|---|
| 1 | **The whole workspace document is 576px wide on a 390px phone.** The header row — back link + a 4-tab `TabBar` + the role badge — has a min-content width of ~576px and nothing in it shrinks, so the layout viewport grows and every screen under `/team/$teamId` renders zoomed out. | `apps/web/src/routes/team/$teamId/route.tsx` |
| 2 | **Projects, Members and Settings are off-screen** — "Members" is clipped mid-word and "Settings" never appears. There is no scroll affordance and no other route to them. A phone user cannot reach team settings at all. | same |
| 3 | **The app pane threw itself over the conversation on every visit.** The "an app you asked for opens beside you" effect keyed on the last message id, which is set on mount — so opening a channel whose last message was an app card covered the channel before it could be read. On a phone the pane is the entire screen. | `libs/ui/src/team/channels-view.tsx` |
| 4 | **Every page of the app loaded `js.stripe.com`.** Importing `@stripe/stripe-js` injects the script as a side effect of the import, and `routeTree.gen.ts` imports every route module statically. A phone opening a channel paid for a third-party script only the billing tab needs. | `apps/web/src/routes/team/$teamId/settings.tsx` |
| 5 | **A missing key in a control-plane payload white-screens the route.** `/team` renders `invites.length` and Members renders `detail.members` with no default, so one absent field replaced the page with "Something went wrong! Cannot read properties of undefined". | `routes/team/index.tsx`, `$teamId/members.tsx` |
| 6 | **Settings shows raw parser errors to the user** — a failed request surfaced as `Unexpected token '<', "<!doctype "... is not valid JSON` in destructive red at the top of the page. | `$teamId/settings.tsx` |

### The channel itself

| # | What |
|---|---|
| 7 | A thread or an app opens under the web tab bar rather than over it, so a full-screen rail on a phone is a full-screen rail minus 100px of chrome it cannot use — and closing it is a 24px `×` in the top-right, the hardest corner to reach one-handed. |
| 8 | THING answers with **uncollapsed source code**: a 40-line API handler wraps mid-token down a phone screen with no way to skip it, and the thread it lives in becomes unreadable. |
| 9 | **A member never sees which team they are in.** The drawer shows CHANNELS and DIRECT MESSAGES and no team name; native picks `teams[0]` and offers no way to switch. |
| 10 | **Creating a channel is hidden behind a `⋮`** while "New category" — the rarer action — is a full-width row. |
| 11 | Members are addressed by raw email (`ana@example.com`) wherever a profile has no display name, which is every member until they set one in a tab a phone cannot reach (see #2). |
| 12 | The composer sits on the very bottom edge of the web surface with no safe-area inset (native gets one from `SafeAreaView`). |

### Polish and play

| # | What |
|---|---|
| 13 | Empty states are bare sentences ("Nobody else has opened this team yet."), and loading states are the literal word `Loading…`. |
| 14 | Nothing is ever unread-badged outside the browser tab title — the bottom tabs, the team name and the channel rows carry no count on a phone. |
| 15 | No press feedback on rows, no transition when the drawer or rail opens, no skeletons — the surface never acknowledges a tap before the network does. |

## Plan

Ordered by what a phone user hits first. Each item names the file it lands in.

### Wave 1 — fit and reach
1. **Bottom tabs on compact, top tabs above `md`.** Generalise `elements/nav/bottom-nav` into a
   data-driven `BottomTabs` (BottomNav keeps its 3-tab shape by delegating), then give the team
   workspace a compact top bar (team name + role) with the four tabs at the bottom where a thumb is.
   Fixes 1 and 2 together, and matches what the native app already does for its own tabs.
2. **Defensive payloads + human errors** — 5 and 6.
3. ~~App pane no longer force-opens~~ · ~~Stripe off the hot path~~ (both done during the review).

### Wave 2 — the channel
4. Rail (thread/app) covers the whole screen on a phone, with a **back row** that names where it
   returns to, and the close target at the top-LEFT where the thumb is.
5. **Collapse long code in a message** behind a "Show code" disclosure with a copy button; keep short
   snippets inline. Lands in the shared markdown/descriptor renderer so `/chat` gets it too.
6. **Team identity + switcher** in the drawer header, on both targets; native stops guessing `[0]`.
7. Safe-area inset for the web composer and the bottom tabs.

### Wave 3 — play
8. Empty states with a face and one clear action; skeletons for the three loading strings.
9. Unread + mention badges on the bottom tabs and on the team name.
10. Press states, a drawer that slides, and a send that acknowledges instantly.

## Progress

Every "done" row below was re-screenshotted at 390×844 after the change.

| Item | State |
|---|---|
| 1 · fits 390 | **done** — the workspace document is 390px wide on every tab (was 576). `nav/bottom-tabs` + `TeamChrome` |
| 2 · reach every tab | **done** — Channels · Projects · Members · Settings, at the bottom, below `md` only |
| 3 · app pane force-open | **done** — `channels-view.tsx`, guarded by a first-settle ref |
| 4 · Stripe on every page | **done** — `@stripe/stripe-js/pure` |
| 5 · defensive payloads | **done** — `/team` and Members normalise `teams`/`invites`/`members` |
| 6 · human errors | **done** — `team-api.ts#call` turns a non-JSON 200 into a sentence |
| 7 · full-screen rail + back | **done** — `RailPane` back row naming the channel, on the left; thread body is a `Scroll` (it CLIPPED on native) |
| 8 · collapse code | **done** — `elements/content/code-block`, wired into markdown AND the `CodeBlock` descriptor, so `/chat` gets it too |
| 9 · team identity/switcher | **done** — `SidebarHeader`; native stops silently opening `teams[0]` |
| 10 · new channel first-class | **done** — a row of its own, out of the `⋮` |
| 12 · safe area | **done** — `env(safe-area-inset-bottom)` on the tab bar, which is now what sits at the edge |
| 13 · empty states | **partly** — the channel has one with a first move ("Ask THING" prefills the composer). The three `Loading…` strings are still strings |
| 14 · unread badges | **partly** — the native Teams tab badges mentions (`BottomNav badges`). The team's own four tabs do not yet |
| 15 · press states | **partly** — tabs, the team header and the code disclosure acknowledge a press; channel rows and message rows do not |
| 11 · display names | **not done** — `memberLabel` already prefers a display name; nobody has one until they set it in Settings, which is only now reachable on a phone. Worth revisiting after that lands with real members |

### Proven on a device

Driven on the Android emulator (`Small_Phone_API_33`, dev client + Metro) against the same rig, after
the gates were unblocked. Confirmed by tapping, one screen at a time:

- the app shell's tab bar still works after being rebuilt on `BottomTabs` (Home · Chat · Teams);
- the sidebar names the team ("Local Team · Editor · 1 member"), closes with its `×`, and offers
  "New channel" as a row;
- the app pane no longer covers the channel on arrival;
- `#design` shows the empty state, and "Ask THING" lands `@thing ` in the composer and raises the
  keyboard;
- a thread opens with "‹ #general" and scrolls to its newest reply, with each long block collapsed —
  "Show 31 more lines of tsx" expands and collapses on tap;
- the app rail opens the project's pages with the same back row.

**Three defects only the device showed**, all now fixed and covered by a native suite:

1. **Every `color-mix()` tint was dropped.** React Native's colour parser has never heard of it, so
   the whole declaration went — THING's ✦ avatar was a bare glyph with no circle, the pinned-app chip
   had no fill, and so on across 26 call sites. Translated in the seam every native prop already
   passes through (`elements/primitives/_native.tsx#toNativeColor`, plus the same for colours written
   inside a `style` object, which is how `AvatarFallback` builds its spectrum tint). Guarded by
   `metro/suites/native-style-units.tsx`.
2. **A `Text` does not centre its own content.** The circle-with-a-glyph idiom (`Prim.Text` sized and
   centred) put the glyph in the top-left corner on a device. A `Box` does the layout and a `Text`
   the glyph — fixed in `SenderAvatar` and the new empty state.
3. **The app card clipped its own "Open" button** off the right edge of the phone — it sized to
   content with nothing allowed to shrink.

### The gates were red before any of this

Both native gates fail on a clean `main` if the last `pnpm install` ran at the repo ROOT: `libs/*`
belongs to two workspaces, so that install re-links its dependencies into the outer store, outside
everything Metro watches. `cd sdk/org && pnpm install` fixes both, and `apps/mobile`'s typecheck with
them. Written up in
[`.issues/root-install-breaks-native-gates.md`](../.issues/root-install-breaks-native-gates.md),
including the two Metro-config "fixes" that look right and boot the app to "Can't find Tamagui
configuration".
