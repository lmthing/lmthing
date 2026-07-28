# Mobile (`apps/mobile`) — the React Native target

`sdk/org/apps/mobile` is an Expo app that renders **the same source** the web app
renders. It contributes a Tamagui provider, a boot order, and nothing else: the
screens it shows — the login screen and the whole chat surface — are imported
from `@lmthing/ui` (`sdk/org/apps/mobile/App.tsx`).

Design notes and the dated decision log live in
`sdk/org/docs/mobile-native-chat.md`; the operational handoff is
`sdk/org/docs/mobile-native-chat-CONTINUE.md`. This page is the grounded summary.

## The governing invariant — one source, two outputs

A `.native` / `.web` file fork is legal for exactly three reasons:

| category | meaning |
|---|---|
| `primitive` | host-element translation (`Box` → RN `View`) |
| `platform` | a capability seam (`storage`, `keyboard`, `api-base`, …) |
| `absent` | the capability does not exist on the target |

**Never** a screen, store, hook or data path. Metro prefers `*.native.tsx` over
`*.tsx`, which is what selects a fork
(`sdk/org/apps/mobile/metro.config.js`).

The forks are not thin: every one funnels its props through
`nativeSafeProps` (`sdk/org/libs/ui/src/elements/primitives/_native.tsx#nativeSafeProps`),
which forwards Tamagui style props, maps `onClick` → `onPress`, and drops
web-only attributes — so a surface writes `<Box padding="$4">` once and both
targets honour it.

### What that seam translates, and why each case exists

- **`display: 'flex'`** — a row on web (the CSS initial `flex-direction`), a
  **column** on React Native (Yoga's initial value). `nativeSafeProps` supplies
  the web-implied `row` when the surface stated no direction; `Col` passes
  `flexDirectionDefault: 'column'` so it keeps its own axis
  (`sdk/org/libs/ui/src/elements/primitives/col/index.native.tsx`).
- **`position: 'fixed'`** — Yoga has `relative`/`absolute`/`static` and no
  `fixed`, so an overlay written the web way silently rejoins normal flow. It is
  translated to `absolute`.
- **The `letterSpacing` scale** — Tailwind's `tracking-*` ramp is em-relative,
  which React Native has no unit for. Native gets the same ramp converted to
  points (`sdk/org/libs/ui/src/theme/tamagui.config.ts`); web keeps the em
  strings. This is the fourth of the config's `isWeb` branches, alongside colour
  tokens, themes and the animation driver.
- **Numeric-only style props** — `letterSpacing`, `fontSize`, the border widths
  and radii, `opacity`, `flex` and the gaps are cast straight to a `Double` by
  Android's view manager, so a CSS string there is a red-screen crash that takes
  the whole tree with it, not a value the platform ignores. `nativeSafeProps`
  converts a bare or `px` number, leaves a `$`-token for the config to resolve,
  and drops anything font- or viewport-relative
  (`sdk/org/libs/ui/src/elements/primitives/_native.tsx#NUMERIC_ONLY_STYLE_PROPS`).
  Dropping is deliberate and matches `isNativeLineHeight`: the surface then gets
  the platform default, which is what it would have got had it said nothing.
- **`100vh`** — there is no viewport unit on native, so a box centred on web with
  `minHeight: 100vh` takes its content's height instead and its contents sit at
  the top of the screen. It is not translated (a percentage string is legal for
  the dimension props, so the seam cannot tell a bad unit from a good one); a
  surface that must centre on both states `flex: 1` as well, which is inert on
  web in a block parent (`sdk/org/libs/ui/src/components/auth/login-screen/index.tsx#LoginScreen`).
- **`display: 'inline-flex'`** — the same instruction as `flex` for everything
  Yoga can express, and React Native accepts only `flex`/`none`/`contents`. It
  was reaching Yoga verbatim AND, by not being literally `'flex'`, skipping the
  direction default above — so every multi-child `Button` stacked its icon above
  its label on a device (that value is in `Button`'s base style), along with 20
  other shared sites. Normalised in `nativeSafeProps`.
- **Overflow does not scroll.** Yoga clips a subtree that exceeds its parent —
  silently, with no gesture to reach the rest. A `Box` with `overflow: 'auto'` is
  a scrolling region in a browser and unreachable content on a phone, which is
  what the team transcript was: one screenful of a conversation and no way past
  it. `Prim.Scroll` is the primitive that means "this scrolls", forked to an RN
  `ScrollView` (`sdk/org/libs/ui/src/elements/primitives/scroll/index.native.tsx`).
  Its `stickToEnd` prop is a prop and not a caller-side effect because the two
  targets pin to the bottom at different MOMENTS: the DOM has laid out by the
  time an effect runs, a `ScrollView` has not, so it must be told on
  `onContentSizeChange` — an effect there scrolls to the end of the content it
  knew about, which for a freshly-opened transcript is about half of it.
- **A DOM-only handler is DROPPED, not translated.** `nativeSafeProps` forwards
  `onClick` (mapped to `onPress`) and the native event props, and discards every
  other `on*` — so a control wired with `onMouseDown` has no handler at all on a
  phone. The `@`-mention picker was: its rows were tappable, highlighted, and did
  nothing. Nothing logs and nothing throws, which makes it the worst-shaped
  failure in this list. `onMouseDown` there is deliberate on web (a click blurs
  the textarea and unmounts the picker before it lands), so the fix branches on
  `isWeb` rather than replacing it
  (`sdk/org/libs/ui/src/team/composer.tsx#MentionPicker`).
- **A bare string child is dropped by React Native**, which raises "Text strings
  must be rendered within a `<Text>` component" and renders nothing — so a menu
  row appears empty. On web the same markup is ordinary, which is why it gets
  written that way. `labelled()` wraps strings for the shared leaves that accept
  arbitrary children (`sdk/org/libs/ui/src/elements/primitives/labelled.tsx`);
  `DropdownItem`, the context-menu `Item` and `ListItem` all had the bug and only
  `Button` had a (private) fix. The gate mounts every such leaf with a bare
  string: `sdk/org/libs/ui/metro/suites/string-children.tsx`.
- **`asChild` must still be measurable.** The native `Dropdown` anchors its panel
  by measuring the trigger, and the `asChild` branch cloned the caller's element
  with the handler but no ref — most callers pass a `Button`, a plain function
  component that forwards none, so the measurement never fired and the menu
  rendered at `(0, 0)`: a bar across the status bar, nowhere near the control
  that opened it. A wrapper carries the ref instead
  (`sdk/org/libs/ui/src/elements/overlays/dropdown/index.native.tsx#DropdownTrigger`).
  The panel also flips to right-alignment near the screen edge, because every
  section menu that uses it is pinned to the right of its header and a phone has
  no room to spare.
- **A synthesised press event is EMPTY.** `onClick` is mapped to `onPress` with
  `{}` — there is no DOM node or mouse behind a native press — so a shared
  handler may use the fact that it fired and nothing else
  (`sdk/org/libs/ui/src/elements/primitives/_native.tsx#toPressHandler`). The team
  composer read `e.target.value` to re-sync its `@` picker and threw on the first
  tap, before a character could be typed. Read a ref or state instead.
- **`onLongPress`** is forwarded by the seam but existed in no prop type, so it
  could not be used from shared code — which pushes a touch-only affordance
  towards a forked surface. It is now on the shared prop surface
  (`sdk/org/libs/ui/src/elements/primitives/_tamagui.tsx#GestureProps`), inert on
  web, and it is what offers "reply in thread" on a phone.
- **A `color-mix()` is dropped whole.** Every tint in the package is written
  `color-mix(in srgb, var(--primary) 12%, transparent)` — a chip's fill, THING's ✦ avatar, the
  active app tab. React Native's colour parser has never heard of the function, so the declaration
  goes and the element renders with NO background: shape-preserving, silent, and invisible to the
  render suites, which store the string without asking a view manager to parse it. The seam now
  translates it (`sdk/org/libs/ui/src/elements/primitives/_native.tsx#toNativeColor`), including
  colours written inside a `style` object rather than as props — which is how `AvatarFallback`
  builds its spectrum tint, so every avatar was uncoloured. Mixing with `transparent` in sRGB is an
  alpha multiply, so the token is resolved to a hex and the result is an `rgba()`; the resolution is
  against the LIGHT theme because a prop mapper has no theme context, which is exact for the
  `primary`/`brand-*`/`spectrum-*` tokens tints actually use and a slight hue shift for the three
  that differ. Guarded by `sdk/org/libs/ui/metro/suites/native-style-units.tsx`.
- **A `Text` does not centre its own content.** The circle-with-a-glyph idiom — a `Prim.Text` given
  a width, a height, a radius and `justifyContent: center` — centres on web and puts the glyph in
  the top-left corner on a device. The `View` does the layout, the `Text` holds the glyph
  (`sdk/org/libs/ui/src/team/messages.tsx#SenderAvatar`).
- **Icons** — `lucide-react` emits raw DOM `<svg>`/`<path>`, which React Native
  has no host component for; `@tamagui/lucide-icons-2` draws the same glyphs
  through `react-native-svg`, which in turn drags React Native into a web bundle.
  Both directions are real, so the icon set is a fork
  (`sdk/org/libs/ui/src/elements/primitives/icons/index.tsx` and its
  `index.native.tsx` sibling). Shared code imports icons from there, never
  directly.

## Home — the landing surface

The signed-in app opens on **Home**, not on chat: a dashboard that shows the three things a person
moves between — conversations, projects, teams — so "where was I?" is answered by looking rather
than by navigating (`sdk/org/libs/ui/src/dashboard/DashboardHome.tsx`). A tab bar switches Home and
Chat and hands off to the teams surface
(`sdk/org/libs/ui/src/elements/nav/bottom-nav/index.tsx`).

It is ONE component for both targets. `apps/mobile` renders it as a tab
(`sdk/org/apps/mobile/App.tsx`) and the web app as the `/home` route
(`sdk/org/apps/web/src/routes/home/index.tsx`); navigation is supplied as props, so the surface
itself cannot tell a tab switch from a router push. The tab bar is likewise responsive rather than
forked — it renders below the `md` breakpoint and disappears above it, where the sidebar already
does that job.

Three facts shape the data layer (`sdk/org/libs/ui/src/dashboard/use-dashboard-data.ts`):

- **Teams come from the GATEWAY**, projects and conversations from the **pod** — two origins, so the
  three sources settle INDEPENDENTLY. An unreachable gateway must not blank a user's conversations.
- **Conversation titles come from `GET /api/projects/:id/sessions`**, not the cross-project session
  ledger. The ledger spans projects in one call and looks like the obvious source, but its `title`
  is usually empty: a device run rendered every row as "Untitled conversation" while the chat
  sidebar showed real names for the same sessions.
- **Teams carry no unread badge.** Unread state lives on each team's own pod, so an honest badge
  would mean waking every team's pod on every visit to Home.

## Boot order

`App.tsx` holds the tree back until `hydrateAuth()` resolves. `getSession()` is
synchronous on both targets, but on native it is answered from a cache filled
from the OS keystore — rendering before that resolves paints a logged-out app to
a logged-in user and then flips
(`sdk/org/libs/auth/src/platform/session-store.native.ts`).

Once authenticated, `AuthGate` wakes the pod before mounting chat, mirroring the
web `PodEnsureGate` (`sdk/org/apps/web/src/lib/gates.tsx`) with the web-only
parts removed:

1. `ensureComputePod` — `POST https://lmthing.cloud/api/compute/ensure`
   (`sdk/org/apps/mobile/src/ensure-pod.ts#ensureComputePod`).
2. `waitForPodEdge` — poll the pod's **own** edge until it stops returning
   Envoy's no-endpoint 503/504
   (`sdk/org/apps/mobile/src/ensure-pod.ts#waitForPodEdge`).

Both calls are absolute, because native has no origin. The edge budget covers a
**cold** wake, not just endpoint propagation: `/api/compute/ensure` returns once
the deployment is scaled up, while a pod that was scaled to zero still has to
boot, which measured well past 25s on a free-tier pod.

`apiBase()` defaults to production, so no configuration is needed for the app to
reach a real pod (`sdk/org/libs/ui/src/platform/api-base.native.ts`).

## What the gates prove — and what they do not

```bash
cd sdk/org
pnpm --filter @lmthing/ui test:native   # ios + android: resolution gate + render suites
pnpm --filter @lmthing/ui test          # the web suites
pnpm typecheck
```

`test:native` runs two things per platform
(`sdk/org/libs/ui/metro/cli.mjs`): a **resolution gate** that builds the real
native graph and asserts the right forks were selected with no web-only package
leaking in (`sdk/org/libs/ui/metro/graph-gate.mjs`), and **render suites** that
mount components through the real React reconciler
(`sdk/org/libs/ui/metro/render.tsx`).

The limits are as important as the coverage:

- **A green graph gate proves a module RESOLVES, not that it RUNS.**
- **`react-test-renderer` has no React Native host config**, so it never runs
  RN's own invariants. A bare string inside a `View` mounts happily in the suite
  and renders as *nothing at all* on a device. The suites therefore assert the
  invariant themselves, walking the mounted tree for strings outside a text host
  (`sdk/org/libs/ui/metro/suites/chat-shell.tsx`,
  `sdk/org/libs/ui/metro/suites/nav.tsx`).
- **A jsdom test cannot see the native target** — `isWeb` is always true there,
  and importing `./x.native` by path is not what Metro does.
- **Style values that Android casts to a `Double`** (`lineHeight`,
  `letterSpacing`, the dimension props) are a crash, not a fallback, when they
  arrive as strings — an unresolved `$`-token reaches the view manager verbatim.
  Asserted over the mounted tree in
  `sdk/org/libs/ui/metro/suites/chat-shell.tsx` and, for the whole numeric-only
  class, in `sdk/org/libs/ui/metro/suites/native-style-units.tsx`.

  This hazard was written here before anything enforced it, and a surface hit it
  anyway: `LoginScreen` passed `letterSpacing={'-0.02em' as unknown as number}`,
  `RCTText` threw `java.lang.String cannot be cast to java.lang.Double`, and the
  app booted to a blank white page. Naming a trap in a doc does not close it —
  `nativeSafeProps` closes it now
  (`sdk/org/libs/ui/src/elements/primitives/_native.tsx#nativeSafeProps`), and the
  suite fails without that guard.

## Device verification

Verified on an Android emulator (`Small_Phone_API_33`, Expo Go) against the
**production** gateway and a live compute pod, 2026-07-27:

- an authenticated session boots the app straight into chat;
- `compute/ensure` + the edge poll wake a scaled-to-zero pod and mount
  `ChatShell`;
- the sidebar, drawer, transcript and composer all render;
- a message typed on the device reaches the pod, runs a turn, and the agent's
  reply streams back into the transcript.

A second run on the same emulator, 2026-07-28, built a **dev client** rather than
using Expo Go — `expo-notifications` is a native module, so Expo Go cannot load
it. That build is what proved the two things below, neither of which any gate
could see:

- `expo-notifications` must be pinned to the SDK's unified version (`~57.0.7`),
  not the old independent `0.32.x` scheme. The mismatched build linked against a
  newer `expo-modules-core` than the tree has and died at startup with
  `NoClassDefFoundError: expo/modules/kotlin/types/AnyTypeProvider`
  (`sdk/org/apps/mobile/package.json`). `npx expo install --check` is what names
  the expected version.
- `POST_NOTIFICATIONS`, `VIBRATE` and `RECEIVE_BOOT_COMPLETED` reach the merged
  manifest from the library's own AAR — `app.json` needs no `plugins` entry for
  them (`sdk/org/apps/mobile/app.json`).

Still **not** proven on a device, and stated as a gap rather than implied:

- **push itself.** `registerForPush` runs only once signed in, inside the Teams
  pane (`sdk/org/apps/mobile/src/TeamScreen.tsx`), and
  `getExpoPushTokenAsync()` needs an EAS project id and an FCM key for
  `org.lmthing.mobile`; neither is provisioned, so it takes the `catch` and
  returns `null` (`sdk/org/apps/mobile/src/push.ts#registerForPush`). The
  emulator itself is not the blocker — this AVD has Google Play services, so it
  can receive a real push once those credentials exist. Nothing about "the phone
  buzzes with the app closed" is verified.
- a real interactive SSO login end-to-end (password login is disabled —
  `.issues/zitadel-password-login-disabled.md` — so verification used an
  already-minted gateway session);
- the `lmthing://` scheme being registered and its redirect intercepted
  (`sdk/org/apps/mobile/app.json` declares the scheme);
- the Android back gesture dismissing an overlay
  (`sdk/org/libs/ui/src/platform/keyboard.native.ts`);
- the **chat** transcript's scrolling. `Prim.Scroll` now exists and the TEAM
  transcript uses it, but `chat/` was not moved onto it in the same change and is
  still a `Box`, so its content is still clipped past one screenful on a device
  (`sdk/org/libs/ui/src/chat/app/ChatView.tsx`). It is the same one-line swap;
  it is listed as a gap rather than done because nothing has driven that surface
  on a device since.

## Opening a project app

A project app is a separately built web bundle the pod serves at `/app/<projectId>/`, so on both
targets it is an embedded document rather than a mounted component
(`sdk/org/libs/ui/src/elements/content/app-view/view.tsx`, `view.native.tsx` for the `WebView`).

Two things about that element are load-bearing and neither is obvious:

- **The entry is deliberately unforked.** `libs/ui`'s `./elements/*` export maps to `index.tsx`,
  which names the WEB file, so a consumer reaching a forked element through that subpath gets the
  web half and Metro never applies its platform extension — `apps/mobile` tried to mount an
  `<iframe>`. A `react-native` export condition does not fix it: Metro does not fall through a
  conditional array when the first pattern has no file, which breaks every element that has no
  fork. The fork therefore sits one level in, behind a relative specifier, which is where platform
  resolution works and why every existing fork (imported relatively from inside the package) had
  never hit this.
- **The bundle must not read `process`.** `buildProjectPages` sets `platform: 'browser'`, which
  governs resolution and not globals; React and Tamagui read `process.env.*` at module scope, so
  without an esbuild `define` every project app threw `ReferenceError: process is not defined`
  before rendering anything (`sdk/org/libs/cli/src/app/build/pages.ts`). That failed in any
  browser, not only in a WebView.

A TEAM app opens in the rail beside the conversation, pinned there by THING when it finishes
building. A PERSONAL app has no conversation to sit beside, so it opens full screen from the
project on Home (`sdk/org/apps/mobile/src/AppScreen.tsx`) — before that, `DashboardHome`'s
`onOpenProject` was never passed and tapping a project did nothing at all.

## Pointing a device build somewhere other than production

A React Native bundle has no origin, so every control-plane host is a literal in
the source — and until this change three files each held their own copy of
`https://lmthing.cloud`, while the shared UI derived the gateway from
`window.location`, which does not exist here and fell through to the production
constant with no way to say otherwise. A device build could be pointed at a local
POD and still asked PRODUCTION every question the gateway answers.

The hosts now come from one place, all overridable, all defaulting to production
(`sdk/org/apps/mobile/src/hosts.ts`):

| Variable | What it points at |
|---|---|
| `EXPO_PUBLIC_API_BASE` | the compute pod (`sdk/org/libs/ui/src/platform/api-base.native.ts#apiBase`) |
| `EXPO_PUBLIC_CLOUD_BASE` | the gateway — including the shared UI's own calls (`sdk/org/libs/ui/src/platform/api-base.native.ts#cloudBaseOverride`) |
| `EXPO_PUBLIC_TEAM_BASE` | a team's pod (`sdk/org/apps/mobile/src/hosts.ts`) |
| `EXPO_PUBLIC_TEST_SESSION` | seeds an already-minted session, since interactive SSO is still a gap |

`babel-preset-expo` inlines these at BUNDLE time, so changing them needs a Metro
restart, not an APK rebuild. With `adb reverse tcp:<port> tcp:<port>` a
`http://localhost:<port>` value reaches the host machine.

## The team surface on a phone

Driven end-to-end on the emulator, 2026-07-28, against a real team-mode pod
behind a local rig that plays Envoy and the gateway (a team pod trusts identity
headers and cannot fabricate them, by design — so something outside the repo has
to inject them). Verified: the channel list and drawer, sending a message,
grouped runs under one header, opening a thread and replying in it, the reply
summary appearing back in the channel, and the keyboard no longer covering the
composer.

Every tappable control on the surface was then driven one at a time, with each
tap attributed to what it logged, which is how the four silent ones above were
found — three of them (`onMouseDown` dropped, bare strings dropped, `asChild`
losing its ref) are the same mistake in different clothes: **web markup that is
correct, and that native discards without complaint.**

Threads follow **Slack's rule**: a message with no replies shows nothing under
it, and the action to start one is revealed by the message being acted on — a
hover toolbar on web, a long press on a phone
(`sdk/org/libs/ui/src/team/messages.tsx#MessageActions`). A permanent "Reply in
thread" under every message turns a channel into a column of the same offer
repeated after everything anyone said. Once a thread exists it gets Slack's
summary bar instead: participant faces, the reply count, and when the last one
arrived (`sdk/org/libs/ui/src/team/messages.tsx#ThreadSummary`).

### What a 390px review changed

A pass at phone width against the same rig, 2026-07-28. The findings and the plan they came from are
in [`design/teams-mobile-ux.md`](../../../design/teams-mobile-ux.md); what the surface does now:

- **The workspace's four tabs are a BOTTOM bar below `md`** and the top strip above it
  (`sdk/org/libs/ui/src/elements/nav/bottom-tabs/index.tsx#BottomTabs`, used by
  `sdk/org/apps/web/src/routes/team/$teamId/route.tsx#TeamChrome`). As one top row — a back link,
  four tabs and a role badge — nothing could shrink below about 576px, so a 390px phone grew its
  layout viewport to fit and rendered every screen zoomed out with `Members` clipped and `Settings`
  off the edge, reachable by no other route. `nav/bottom-nav` is now the app shell's three tabs
  rendered through the same bar.
- **The sidebar names the team and switches between them**
  (`sdk/org/libs/ui/src/team/sidebar.tsx#SidebarHeader`). It is the one piece of chrome both targets
  have: the native screen renders `TeamChannelsView` and nothing else, so it opened `teams[0]`
  without ever saying which team that was and offered no way to a second
  (`sdk/org/apps/mobile/src/TeamScreen.tsx`). Creating a channel moved out of a section's `⋮` and
  into a row of its own, next to the "New category" that had one.
- **A rail that covers the screen is a place, and gets a back control** naming what it returns to,
  on the left where a thumb is (`sdk/org/libs/ui/src/team/rail.tsx#RailPane`). The `×` in the
  top-right stays for the desktop shape, where the rail is a panel beside the conversation.
- **A long code block opens collapsed** with a peek and "Show N more lines"
  (`sdk/org/libs/ui/src/elements/content/code-block/index.tsx#CodeBlock`), used by both the markdown
  renderer and the `CodeBlock` descriptor
  (`sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:77-90`). THING answers a "build me an
  app" turn with whole source files; on a phone one reply was thirty screenfuls and the message
  after it was unreachable.
- **An app THING built no longer throws itself over the conversation on every visit.** The effect
  that opens it for whoever asked keyed on the last message id, which is set on mount — so opening a
  channel whose last message was an app card covered the channel before it could be read
  (`sdk/org/libs/ui/src/team/channels-view.tsx:107-133`).
- **An empty channel offers the first move** rather than two grey sentences, and "Ask THING" hands
  the composer a half-written message instead of sending one
  (`sdk/org/libs/ui/src/team/channels-view.tsx#ChannelEmptyState` ·
  `sdk/org/libs/ui/src/team/composer.tsx#Composer`).
- **The Teams tab carries a mention badge.** The pane stays mounted while hidden, so it is the only
  thing that can know a mention arrived while the member was on Home
  (`sdk/org/apps/mobile/App.tsx#HomeShell`). Note this is the TEAM's own mention count from the live
  socket, not the per-team unread that Home deliberately does not badge (above).
