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
than by navigating (`sdk/org/libs/ui/src/dashboard/DashboardHome.tsx`).

It is ONE component for both targets. `apps/mobile` renders it as a pane
(`sdk/org/apps/mobile/App.tsx`) and the web app as the `/home` route
(`sdk/org/apps/web/src/routes/home/index.tsx`); navigation is supplied as props, so the surface
itself cannot tell a pane switch from a router push.

### Switching surfaces

Home / Chat / Teams live in `SurfaceSwitcher`
(`sdk/org/libs/ui/src/elements/nav/surface-switcher/index.tsx`), a pill row in the SIDEBAR — the
same slot that used to link Studio / Computer / Team. There is **no bottom tab bar**: a bar pinned
across the foot of the screen is a permanent slice of a phone's shortest dimension spent on
navigation used seconds at a time, and it sat under the chat composer, pushing the one
constantly-used control up off the keyboard.

One component serves both targets, and the `onSwitch` prop is the seam:

| `onSwitch` | Target | Renders | Behaviour |
|---|---|---|---|
| supplied | native | Home · Chat · Teams | switches panes in-process — there is no router |
| omitted | web | Chat · Teams | hyperlinks via `crossAppOrigin`; **Home is dropped** |

Home is absent on web because there is no `lmthing.home` surface for `crossAppOrigin` to resolve —
`/home` is a route inside the unified app — and linking it somewhere wrong is worse than leaving
the dashboard to the route that already reaches it.

On mobile, Chat reaches the switcher through `AppShell`'s existing mobile sidebar drawer; Home and
Teams have no sidebar of their own, so `App.tsx` supplies a hamburger and the same `Drawer` for
them (`sdk/org/apps/mobile/App.tsx#HomeShell`). Its `badges` prop carries the team mention count
that the tab bar used to show — the Teams pane stays mounted while hidden, so it keeps hearing its
channel socket and remains the only thing that can report a mention arriving elsewhere. The
hamburger is 48×48pt (Android's stated minimum, above Apple's 44) rather than the 32×32 it used to
be — a hit-test that small under-shoots both platforms' own guidance.

**Tapping a TEAMS row or an INVITATIONS card used to do nothing.** `DashboardHome`'s `onOpenTeam`
defaults to a cross-app browser hand-off — `openTeamsSurface` → `crossAppOrigin('team')`
(`sdk/org/libs/ui/src/lib/app-urls.ts#crossAppOrigin`) — which resolves to `''` off the web
(`isWeb()` is false on native) and silently no-ops. `App.tsx` now passes `onOpenTeam`
(`sdk/org/apps/mobile/App.tsx#HomeShell`), switching to the Teams pane and telling `TeamScreen`
which team was tapped. `TeamScreen` used to always open `teams[0]` regardless of which row was
pressed; it now takes an `openTeamId` (and an `openChannelId`, for the push deep link below) and
resolves the request against the member's own list rather than trusting it blindly — a stale
invite id or a team since left is ignored, not honoured, so the screen never silently swaps onto
some OTHER team (`sdk/org/apps/mobile/src/team-focus.ts#resolveFocusTeamId`,
`sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`).

**The Android back button did nothing for a full-screen project app** — `Drawer`/`Dialog`
(`libs/ui`) already wire it to their own `onDismiss`, but `AppScreen` had no listener, so with
nothing claiming the event the OS default (background, or exit) took over and the only way out was
the small corner `×`. `AppScreen` now closes on back the same way
(`sdk/org/apps/mobile/src/AppScreen.tsx#AppScreen`). Back also now steps from Chat or Teams to Home
instead of exiting the app outright, registered only while neither the nav drawer nor a full-screen
app is open — the guard keeps it from ever competing with `Drawer`'s or `AppScreen`'s own listener,
rather than relying on Android's LIFO dispatch to sort out several active ones
(`sdk/org/apps/mobile/App.tsx#HomeShell`). Chat's own thread rail (`AppShell`'s mobile sidebar,
`libs/ui`) is invisible to this shell, so THAT case still relies on ordering: its listener registers
strictly after this one, only while its own rail is open, so it is asked first.

**The nav `Drawer`'s width was a CSS `rem` string** (`width="16rem"`), meaningless on Yoga —
`nativeSafeProps` deliberately excludes `width` from its numeric cast (`libs/ui`), so the string
reached the native view unparsed and the drawer sized to its content instead of 16rem wide. The call
site now passes a Tamagui token, `width="$64"` — `size['64']` in
`sdk/org/libs/css/src/tamagui/tokens.generated.ts` is exactly 256, the same 256 sixteen root-em units
resolve to on web, so this is exact, not an approximation (`sdk/org/apps/mobile/App.tsx#HomeShell`).
`Drawer`'s own `width` prop accepts exactly that — a Tamagui token or a bare number, never a CSS
length — for the same reason (`sdk/org/libs/ui/src/chat/components/ui/Drawer.tsx#Drawer`).

**Signing out was unreachable.** `logout()` has existed on `@lmthing/auth` since passwordless
email sign-in shipped, and `DashboardHome`'s ACCOUNT section (`libs/ui`) offers "Delete account" and
"Privacy policy" only — there was no way to sign out of the app short of clearing its storage from
the OS settings. The nav drawer now carries a "Sign out" row below the switcher
(`sdk/org/apps/mobile/App.tsx#SignOutRow`), confirmed with an `Alert` before it fires. It also calls
`POST /api/push/unsubscribe` (`sdk/org/apps/mobile/src/push.ts#unregisterPush`,
`cloud/gateway/src/routes/push.ts`) BEFORE clearing the session — otherwise a signed-out phone keeps
its subscription row and goes on receiving the account's team notifications the moment anyone else
signs into the same device, which is a privacy bug rather than a tidiness one.

### The chat surface with no conversation open

`NoSessionPane` is what the chat surface shows before a conversation is selected
(`sdk/org/libs/ui/src/chat/app/NoSessionPane.tsx#NoSessionPane`, rendered by
`sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`). It carries a `+ New chat` button and, where
the sidebar is a drawer, a `Your conversations` button that opens it.

It used to be the single sentence "Select or start a chat from the sidebar", which is true on web
— the sidebar is a docked column beside it — and false on a phone, where the sidebar is an overlay.
Closing that overlay left a blank screen holding one instruction that named something not on it and
nothing to press, which is indistinguishable from a broken app.

The word "sidebar" therefore never appears in the mobile arrangement, and the pane owns the actions
rather than describing them. Starting a chat is the same call the sidebar's own button makes
(`sdk/org/libs/ui/src/chat/app/session-control.ts#startSession`) — that module exists because
opening a session used to be private to `Sidebar.tsx`, so only the sidebar could do it. Its failure
is caught and shown: a pod that has scaled to zero answers 503 for the ~20s it takes to wake, so
the press most likely to fail is the first one after opening the app, and an uncaught rejection
there is a full-screen red box on a device.

### The composer's one-line ⇄ stacked arrangement

Past one line the message text takes the full width and the controls move to a row beneath it
(`sdk/org/libs/ui/src/chat/app/Composer.tsx#Composer`). Two things about it are load-bearing on a
phone and invisible on web:

- **Both arrangements are ONE tree.** The field stays the same Row's second child in each; the
  buttons beside it render as `null`, which holds their slots. Written as two branches the field
  changed PARENT, and React reconciles by position — a `key` only disambiguates siblings — so
  crossing that boundary remounted the input, destroying the native `TextInput` and dismissing the
  keyboard mid-sentence.
- **The height of one line is measured, not declared, and measured while the box is EMPTY**
  (`Composer.tsx#ONE_LINE_CEILING`). An RN `TextInput` reports `contentSize.height` in the
  platform's own terms — Android adds its internal padding — so a fixed threshold read "already
  wrapped" for a box with one character in it. Taking the smallest measurement seen instead fails
  the other way: a freshly mounted field first reports its `minHeight` clamp, below what an empty
  box settles at, so an *empty* composer measured as wrapped and stayed stacked after every send.
  An empty box cannot lie about its own height.

The growth itself lives in the native primitive, not the surface
(`sdk/org/libs/ui/src/elements/primitives/controls.native.tsx#TextArea`): `multiline` alone does
not auto-grow, and `Composer` cannot ask "am I on a phone?" without becoming two components.

Three facts shape the data layer (`sdk/org/libs/ui/src/dashboard/use-dashboard-data.ts`):

- **Teams come from the GATEWAY**, projects and conversations from the **pod** — two origins, so the
  three sources settle INDEPENDENTLY. An unreachable gateway must not blank a user's conversations.
- **Conversation titles come from `GET /api/projects/:id/sessions`**, not the cross-project session
  ledger. The ledger spans projects in one call and looks like the obvious source, but its `title`
  is usually empty: a device run rendered every row as "Untitled conversation" while the chat
  sidebar showed real names for the same sessions.
- **Teams carry no unread badge.** Unread state lives on each team's own pod, so an honest badge
  would mean waking every team's pod on every visit to Home.

## Push notifications

Verified end to end on the emulator, 2026-07-30: a notification rendered in the shade with the app
backgrounded. The chain, and what each link needs, because a break anywhere in it looks identical
from the app (`registerForPush` returns `null` and push reads as "not implemented"):

| link | needs | where |
|---|---|---|
| `FirebaseApp` initialises | `google-services.json` compiled into the build | `sdk/org/apps/mobile/google-services.json`, referenced by `android.googleServicesFile` |
| `getExpoPushTokenAsync()` returns a token | the EAS project id **and** an FCM v1 credential on EAS | `extra.eas.projectId`; the key is uploaded to EAS, never in this repo |
| the gateway can target the device | `POST /api/push/subscribe` | row in `push_subscriptions` (`kind` `expo`) |
| FCM delivers | EAS's FCM v1 service-account key for the Firebase project | Expo servers |

Three things cost real time to learn and none are guessable:

- **`google-services.json` is read at BUILD time.** Adding it is not enough; `android.googleServicesFile`
  has to name it, and the native project has to be rebuilt (`expo prebuild` copies it to
  `android/app/`). A JS-only reload cannot pick it up.
- **A force-stopped app receives nothing.** Android puts a package killed with `am force-stop` into
  its *stopped* state and FCM will not deliver to it — by design, not a bug. Testing "with the app
  closed" that way produces a delivered-but-invisible push and looks exactly like a broken
  credential. Background it with HOME instead.
- **Expo's `status: ok` on send means QUEUED, not delivered.** The delivery answer is a separate
  call, `POST /--/api/v2/push/getReceipts` with the send id. A rejected FCM credential shows up
  there and nowhere else.

`registerForPush` never throws: a declined permission dialog is a normal outcome, and a shell that
cannot boot because notifications are unavailable is far worse than no notifications
(`sdk/org/apps/mobile/src/push.ts#registerForPush`).

### Tapping a notification used to just foreground the app

The gateway always sends `data: { url }` so a tap lands somewhere specific
(`cloud/gateway/src/lib/push.ts`, `sdk/org/libs/cli/src/server/team-push.ts#pushPayload` —
`/team/<teamId>/channels?channel=<channelId>`), but nothing native-side ever read it: a tap just
foregrounded whichever tab was last open.

`watchPushDeepLinks` (`sdk/org/apps/mobile/src/push.ts#watchPushDeepLinks`) covers both ways a tap
reaches the app — a live `addNotificationResponseReceivedListener` while it is already running, and
one call to `getLastNotificationResponseAsync` for the cold-start case, where the process did not
exist yet to have had a listener. `App.tsx` wires the result to switching to the Teams pane and
naming the team (and channel) to `TeamScreen` (`sdk/org/apps/mobile/App.tsx#HomeShell`); a tapped
notification also closes whatever full-screen project app was covering the tabs, the same as a
hardware back press does.

The url is parsed with plain string ops rather than the WHATWG `URL` global
(`sdk/org/apps/mobile/src/push-deeplink.ts#parseTeamDeepLink`) — this repo avoids `URL` on native
elsewhere (`sdk/org/libs/auth/src/AuthProvider.tsx`, gated behind `isWeb()`) because Hermes ships
without an implementation and nothing here pulls in a polyfill. The function is split into its own
module specifically so it is unit-testable without `react-native` in the import graph at all: `push.ts`
imports `Platform` from `react-native` at module scope, and Vite/Rollup cannot parse real React
Native's Flow syntax outside Metro's own babel transform
(`sdk/org/apps/mobile/src/push-deeplink.test.ts`).

A malformed or foreign shape — a full `https://…` URL rather than the bare path the gateway actually
sends, an unrelated custom-scheme link — resolves to `null` rather than a half-match or a crash;
`parseTeamDeepLink`'s own test file asserts this rather than leaving it implied
(`sdk/org/apps/mobile/src/push-deeplink.test.ts`).

**Wiring both the cold-start check and the live listener risks handling the SAME tap twice** — Expo's
own docs note both can fire for one delivered notification in the same launch, which reads as a
duplicate deep link (closing a rail the member had just opened, or worse if a future handler were
not idempotent). Every response is now deduped by its own `request.identifier` first
(`sdk/org/apps/mobile/src/push-deeplink.ts#createNotificationDeduper`,
`sdk/org/apps/mobile/src/push.ts#watchPushDeepLinks`) — a pure last-seen-id guard, tested without
`react-native` in the import graph for the same reason `parseTeamDeepLink` is split out. It only ever
suppresses a REPEAT of the exact same id: two distinct notifications arriving moments apart both
still open, which is the case a naive "ignore anything while one is in flight" debounce would have
gotten wrong.

A tap landing on a screen that is already showing that team/channel is not specially handled and
does not need to be: `App.tsx`'s handler unconditionally calls `setTeamFocus`/`setTab` with the same
values, React bails out of an identical state update, and `TeamScreen`'s own effects are keyed on
`openTeamId`/`openChannelId` changing, not on the deep link firing
(`sdk/org/apps/mobile/App.tsx#HomeShell`, `sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`). A
deep link naming a team the member has since left is caught one layer down, by
`resolveFocusTeamId` (`sdk/org/apps/mobile/src/team-focus.ts#resolveFocusTeamId`) refusing to select
a team not in the member's own list — already covered by
`sdk/org/apps/mobile/src/team-focus.test.ts`. None of this — the double-tap dedup, the
already-there case, or the stale-team case — has run on a device or emulator; all three are proven
by unit tests against the pure decision functions only.

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

**A failure here used to be a dead end.** A bad network, the 120s cold-wake timeout, or a 5xx from
either call landed on static text with no way back in short of force-quitting the app — `AuthGate`
latched a ref true on the first attempt and never let a second one start. It now shows an
`ActivityIndicator` while waiting (a cold wake can take much of that 120s budget, and bare text alone
read as a hang) and a Retry button on failure, which bumps a counter the effect depends on
(`sdk/org/apps/mobile/App.tsx#AuthGate`).

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

- ~~push itself~~ — **verified on a device 2026-07-30**, see
  [Push notifications](#push-notifications) below.
- a real interactive SSO login end-to-end (password login is disabled —
  `.issues/zitadel-password-login-disabled.md` — so verification used an
  already-minted gateway session);
- the `lmthing://` scheme being registered and its redirect intercepted
  (`sdk/org/apps/mobile/app.json` declares the scheme);
- the Android back gesture dismissing an overlay
  (`sdk/org/libs/ui/src/platform/keyboard.native.ts`) — nor, newer and on the same seam, dismissing
  a full-screen project app or stepping from Chat/Teams back to Home
  (`sdk/org/apps/mobile/App.tsx#HomeShell`, `sdk/org/apps/mobile/src/AppScreen.tsx#AppScreen`);
- the **chat** transcript's scrolling *under load*. The swap itself is done —
  the transcript is a `Prim.Scroll` with `stickToEnd`, not the `Box` it was when
  its content was clipped at one screenful
  (`sdk/org/libs/ui/src/chat/app/ChatView.tsx:286-288`) — but no device run has
  put more than a couple of screenfuls through it, so the follow-on-new-output
  behaviour is proven by the primitive's own tests rather than by a phone.
- the reachability pass documented above (tapping a TEAMS/INVITATIONS row, the push
  notification deep link, sign-out + push unsubscribe, the pod-start Retry button, `TeamScreen`'s
  retry/`AppState` refresh, and the `'default'` orientation change) — none of it has run on a device
  or an emulator. Both native gates are green (`pnpm test:native`, `tsc --noEmit`), which proves the
  code resolves and typechecks; it proves nothing about what a finger touching a phone actually
  sees, per [What the gates prove — and what they do not](#what-the-gates-prove--and-what-they-do-not)
  above.

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
project on Home (`sdk/org/apps/mobile/src/AppScreen.tsx#AppScreen`) — before that, `DashboardHome`'s
`onOpenProject` was never passed and tapping a project did nothing at all.

Three reachability fixes on that screen: the Android back button now closes it, the same way the
corner `×` always has, via the same `onDismiss` seam `Drawer`/`Dialog` already use
(`sdk/org/apps/mobile/src/AppScreen.tsx#AppScreen`,
`sdk/org/libs/ui/src/platform/keyboard.native.ts#onDismiss`); the `×` itself is 48×48pt of tap target
(16px icon + 16px padding a side) rather than the 24×24 `padding="$1"` gave it; and `Opening
{name}…`, the state before the pod has answered which kind of app this is, now shows an
`ActivityIndicator` rather than bare text alone.

### Two builders, and only one of them needs a WebView

Everything above describes a `system-appbuilder` app, which is the default and is unchanged. The
other builder, `system-viewbuilder`, does not produce a bundle at all: its pages are **view specs**
— data — and `@lmthing/ui/view` renders them on the `Prim.*` primitives, so they mount as real
native views. **A viewbuilder app never touches a WebView, on any page.** That is the single
capability the spec pipeline exists to deliver, and no amount of improvement to a TSX-authoring
builder can produce it, because its output is a browser bundle.

The branch is one question asked once, when the app is opened
(`sdk/org/apps/mobile/src/app-views.ts#fetchAppTarget`):

```
GET <pod>/api/apps/<projectId>/views   →  { views, components, endpoints, shell }
                                          views.length > 0  ⇒  native
                                          anything else     ⇒  the WebView, as before
```

There is no flag on the project to consult, deliberately: the thing that decides the branch and the
thing the native path needs are the same fetch. The route is
[`GET /api/apps/:id/views`](../cli-api/rest/apps.md), and `endpoints` travels in that payload
because on web the manifest is injected into the host page as `window.__APP_ENDPOINTS__` and here
there is no host page to inject anything into.

**Every failure resolves to the WebView.** A pod that predates the route, an offline moment, a 500
— none of those is evidence that the project is a spec app, and the appbuilder path is the one that
works for every app built so far. The branch that must never be partial is the one *inside* a known
viewbuilder app, and that one is settled by this single answer
(`sdk/org/apps/mobile/src/app-views.ts#fetchAppTarget`).

What the native host contributes is exactly the two things the divergence budget is for
(`sdk/org/apps/mobile/src/AppScreen.tsx#NativeApp`):

- **Which page is on screen**, because native has no URL for it to live in — the same reason
  `TeamScreen` owns its rail. `ViewNavigation.navigate` hands back a route with its `[param]`s
  already filled (filling them from `$result.id` is binding resolution, and that is the renderer's
  job), so the host stores that literal path and matches it back to the spec that owns it, static
  segments winning over parameters (`sdk/org/apps/mobile/src/app-views.ts#resolveRoute`).
- **The platform capabilities the client leaves to its host** — `openExternal` (`Linking`), the
  clipboard, a confirmation (`Alert`). Each is one line of React Native and each would otherwise be
  a silent no-op on a device.

The client is built with the app base, not the pod root
(`` `${baseUrl}/app/${projectId}` ``): the request builder appends `/api<routePath>`, and a
project's handlers are served under `/app/<project>/api/*`. Absolute, and authenticated with the
pod token — the `teamTokenGetter` pattern, no cookie and no same-origin assumption
(`sdk/org/apps/mobile/src/team.ts#teamTokenGetter`).

The **team rail gets the same branch**. `onOpenApp` no longer sets the rail directly: it starts the
probe, and the answer picks the destination — the native screen full-width, or the rail exactly as
before for an appbuilder app (`sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`). On a phone the
rail is full-width anyway, so what actually differs is the back affordance, and each screen brings
its own. The probe's answer is handed to `AppScreen` rather than re-asked, since the team surface
had to ask before it could choose.

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
  off the edge, reachable by no other route. These are the TEAM WORKSPACE's own four tabs; the app
  shell's three surfaces are not a bar at all — see [Switching surfaces](#switching-surfaces).
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

### Loading, error and empty states used to be dead ends

`TeamScreen`'s four non-happy-path renders — loading, a failed `listTeams`, "not on a team yet",
and "opening the team" — were each a single bare sentence with no spinner and no retry. Worse than
just unpolished: because this pane is mounted-but-HIDDEN rather than unmounted while somebody is on
Home or Chat (above), switching away from a failed fetch and back to it never retried — the only way
past it was force-quitting the app (`sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`). The mount
effect is now a `refresh` callback a Retry button can call again, loading and "opening the team" show
an `ActivityIndicator`, and "not on a team yet" also offers `Linking.openURL` to `lmthing.team` — the
one place a member can actually create or join a team, since there is no such flow natively.

Two more things go stale the same hidden-not-unmounted way, and both are now covered:

- **Coming back from the background.** `TeamScreen` listens for `AppState` turning `'active'` and
  calls `refresh` again — a member could have been added to, or removed from, a team entirely
  outside the app while it sat backgrounded (`sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`).
  `HomeShell` does the same for the Home dashboard, but `DashboardHome` (`libs/ui`) has no reload
  prop of its own to call — so it is remounted instead, via a `key` bumped on the same `AppState`
  transition. Remounting a HIDDEN pane costs nothing visible and, unlike `TeamScreen`, does not risk
  a live socket: `DashboardHome` holds no socket of its own to drop
  (`sdk/org/apps/mobile/App.tsx#HomeShell`).
- **A refresh dropping the selected team** (membership revoked, the team deleted) used to read as a
  permanent "Opening the team…" spinner — `team` stayed `undefined` forever once its id was no
  longer in the list. Selecting a team now falls back to the first remaining one when the current
  selection no longer exists, in the same effect that honours an `openTeamId` request, so the two
  rules cannot race each other's `setTeamId` in one commit
  (`sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`).

**Pull-to-refresh — Home fixed, Teams still not.** `DashboardHome`'s own `Prim.Scroll` now wires
`onRefresh`/`refreshing` to its internal `useDashboardData()` result
(`sdk/org/libs/ui/src/dashboard/DashboardHome.tsx:187-188`), and the native `Scroll` fork renders a
real `RefreshControl` whenever `onRefresh` is given
(`sdk/org/libs/ui/src/elements/primitives/scroll/index.native.tsx:126-130`) — entirely inside
`libs/ui`, so `apps/mobile` needed no change at all to inherit it; `App.tsx` never touches
`DashboardHome`'s refresh props because there are none to pass. The Teams channel list has no such
prop yet (`TeamChannelsView`, `sdk/org/libs/ui/src/team/channels-view.tsx`), so pulling down on a
channel list still does nothing — that half remains a `libs/ui` change outside this app's own
surface.

### Round 2 — older history, DM ordering, Escape-to-dismiss, copy

A second UI/UX pass over `libs/ui/src/team/**`, scoped to the shared package (both targets inherit
it; nothing here touched `apps/mobile` itself).

- **Older history was unreachable.** `TeamClient.messages` called `/channels/:id/messages` with no
  parameters and threw away the `hasMore` the pod already returned — a channel showed one page
  (the pod's own default, 50 messages) and nothing before it, with no hint more existed, even
  though the route already reads `?limit=`/`?before=` and pages backwards
  (`sdk/org/libs/cli/src/server/routes/team-channels.ts#handleListMessages`, documented at
  [`cli-api/rest/team.md`](../cli-api/rest/team.md)). `TeamClient.messages` now takes an optional
  `{limit?, before?}` (`sdk/org/libs/ui/src/team/client.ts#TeamClient`), `useTeamChat` surfaces
  `hasMore`/`loadingOlder`/`loadOlder` (paging backwards from the oldest message currently loaded,
  discarding an in-flight page if the channel changes before it resolves), and a "Load earlier
  messages" affordance sits at the TOP of the transcript
  (`sdk/org/libs/ui/src/team/channels-view.tsx#LoadEarlierButton`). Prepending older messages had
  to not fight `stickToEnd` (`Scroll`'s own layout effect can snap the region to its bottom on
  every render) and had to preserve the reader's scroll position rather than shove the transcript
  down by the height of what just arrived — `useScrollAnchor`
  (`sdk/org/libs/ui/src/team/channels-view.tsx`) captures the anchor synchronously before the
  fetch's state update and restores it in a `useLayoutEffect`, which — because React runs a
  child's layout effects before its parent's, and `Scroll` is a descendant — fires AFTER `Scroll`'s
  own and so has the last word.
- **The DM list had no ordering.** `sidebar.tsx#DirectMessages` drew `directory().members` in
  whatever order the API returned them, while a channel already got bold/mention treatment
  (`MentionBadge`). Now ranked — mentions first, then anything unread, then an existing (read)
  conversation, then someone never messaged, alphabetical within each tier. Deliberately NOT
  "most recently active": the pod hands the client a boolean `hasUnread` and an exact mention
  count, never a timestamp (`team-reads.ts#ChannelUnread`) — the same reason the previous pass
  declined to draw an unread divider (`design/team-chat-ux-progress.md`). A recency guess built
  from whichever messages happened to arrive over the socket since mount would be wrong for
  anyone who was not watching the whole time, and unstable besides.
- **Escape closed nothing.** The thread rail, the app rail and the compact channel drawer could
  only be dismissed by finding and clicking their own close control. `RailPane` now calls
  `onDismiss` unconditionally on mount (`sdk/org/libs/ui/src/team/rail.tsx#RailPane`) — it has no
  `open` flag to gate on the way `Drawer`/`Dialog` do, because it only exists in the tree while
  `rail` is non-null in the first place — and `channels-view.tsx`'s own hand-rolled drawer wires
  the same seam behind a `compact && drawerOpen` guard. One companion fix this exposed: the
  composer's OWN Escape handler (closing the `@` picker) did not stop the keydown from bubbling,
  so dismissing the picker while replying in an open thread would also have thrown the whole rail
  closed — one keystroke, two unrelated reactions. Fixed with `e.stopPropagation()` in that one
  branch (`sdk/org/libs/ui/src/team/composer.tsx`).
- **A message had no way to be copied.** `MessageActions` offered only "Reply in thread"
  (`sdk/org/libs/ui/src/team/messages.tsx#MessageActions`). Copy is now offered beside it, through
  `platform/clipboard`. Edit/delete are deliberately NOT here — the pod has no endpoint for
  either. On native the reveal gesture is still long-press, but it now REVEALS the toolbar (Copy
  and, where offered, Reply) rather than firing reply directly — a second tap replaces what used
  to be a single gesture, the cost of getting Copy onto the one gesture a phone has. Copy is
  reachable there only on a message that can also be replied to: the touch-responder system is how
  a device tells "interactive" from "not", and a message with no `onReply` is pinned to carry NO
  responder at all by this package's own native suite
  (`libs/ui/metro/suites/team.tsx#"a long press is what offers the thread on a touch device"`) — so
  a thread's own messages get Copy on web (hover costs nothing extra there) but not on a phone.

Not built: real-time recency for the DM list (above) and pull-to-refresh on the channel list
(previous paragraph) — both need data or a prop this pass did not add.

## Connectivity and haptics

**Nothing told the user they were offline.** A dropped chat/team socket and a quiet channel read as
the same thing — silence — so a member had no way to tell "nobody is talking" from "my phone lost
the network". `useConnectivity` (`sdk/org/apps/mobile/src/connectivity.ts#useConnectivity`) reads
`expo-network`'s own connectivity state — device-level, independent of any one request's latency, which
is what keeps `OfflineBanner` (`sdk/org/apps/mobile/src/OfflineBanner.tsx#OfflineBanner`) from
becoming the "scary banner on a slow request" this was explicitly asked not to build: a slow pod
response reports nothing here, only an actual connectivity loss does. Offline is `isConnected ===
false` OR `isInternetReachable === false` — the second catches Wi-Fi with no usable upstream (a
captive portal, Android's `NET_CAPABILITY_VALIDATED` failing), which `isConnected` alone would miss
(`sdk/org/apps/mobile/src/connectivity.ts#isOffline`). The banner is mounted once at the root of the
tree, above `AuthGate` (`sdk/org/apps/mobile/App.tsx`), because connectivity is a property of the
device, not of whichever of Home/Chat/Teams happens to be open — it is exactly as relevant on the
login screen (signing in needs a network too) as once a conversation is open.

**`expo-network` is a new native dependency** (`~57.0.1`,
`sdk/org/apps/mobile/package.json`) — like `expo-notifications`, it changes the native fingerprint
and needs a fresh dev-client / store build before the banner can appear on a device; nothing in this
pass has run it on one.

**No haptics anywhere** — sending a message, opening a thread, a long-press reply, and a failed
action all felt identical. `sdk/org/apps/mobile/src/haptics.ts` adds three restrained primitives
(`hapticSuccess`, `hapticWarning`, `hapticLight`), each lazily importing `expo-haptics` the same way
`./push.ts` lazily imports `expo-notifications` — a native module that is not yet linked in some
environment must not stop the app from booting. **This is also a new native dependency**
(`expo-haptics` `~57.0.1`), same fingerprint/store-build caveat as `expo-network` above.

Wired at every point that is actually inside `apps/mobile`: a warning when the pod fails to start
and a success confirmation on RECOVERY only — not on an ordinary cold boot, which would otherwise
buzz on every app open (`sdk/org/apps/mobile/App.tsx#AuthGate`); a once-per-failure warning when
`TeamScreen`'s team list fetch fails, guarded so a phone with no signal does not buzz on every
silent `AppState` background retry (`sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`); and a
light tap acknowledgement on `onOpenApp`, because that press starts a network round trip with no
other visible change until it resolves and nothing today gives it a spinner
(`sdk/org/apps/mobile/src/TeamScreen.tsx#TeamScreen`).

**Not wired — the three interactions actually named in the brief: sending a message, opening a
thread, a long-press reply.** All three live in `libs/ui`, outside this app's partition, and
wiring them needs a new platform seam there (mirroring `sdk/org/libs/ui/src/platform/keyboard.native.ts`'s
`onDismiss` pattern) rather than anything `apps/mobile` can reach:

| interaction | call site |
|---|---|
| team message send | `sdk/org/libs/ui/src/team/composer.tsx:192` (`await onSend(text)`) |
| chat message send | `sdk/org/libs/ui/src/chat/app/Composer.tsx:209-225,390,526` (`handleSend`) |
| opening a thread | `sdk/org/libs/ui/src/team/channels-view.tsx:481,486` (`onOpenThread(root.id)`) |
| long-press reply | `sdk/org/libs/ui/src/team/messages.tsx:443-474` (`MessageActions`, `onLongPress`) |

The primitives in `apps/mobile/src/haptics.ts` cannot be imported from `libs/ui` (the dependency
points the other way — the app depends on the shared package, never the reverse), so closing this
gap means a `libs/ui/src/platform/haptics.ts` + `.native.ts` fork (inert on web, matching every
other seam in [the governing invariant](#the-governing-invariant--one-source-two-outputs) above),
called from the four sites in the table.

## Shipping it — Google Play

The app is `org.lmthing.mobile`, an Expo managed build. Its whole configuration is
`sdk/org/apps/mobile/app.config.js` — a `.js` file rather than `app.json` because every
colour in it is READ from the design tokens rather than transcribed
(`sdk/org/apps/mobile/app.config.js#color`). An adaptive-icon ground or a splash colour
written as a hex literal is the same class of bug as a raw colour in a stylesheet, and
no linter looks at app config.

### The brand assets are generated, not drawn

`sdk/org/apps/mobile/scripts/generate-icons.py` produces the launcher icon, the Android
adaptive layer, the splash mark, the notification silhouette and both Play listing
images from `tokens.json` and the repo's own Cera Round Pro Bold
(`sdk/org/apps/mobile/scripts/generate-icons.py:162-186`). `pnpm icons` re-runs it, so a
brand colour change is one command rather than an afternoon in an image editor.

Three things it knows that are easy to get wrong:

- **The mark sits on the DARK ground.** 48dp is the size that decides a launcher icon,
  and the light variants of the same wordmark wash out against a pale wallpaper — the
  rose `l` stops being legible first.
- **The adaptive layer is sized by its DIAGONAL, not its width**
  (`sdk/org/apps/mobile/scripts/generate-icons.py:60-64`). Android guarantees only a 66dp
  circle of the 108dp canvas, and a launcher may mask to exactly that circle. At 0.58 of
  the canvas wide the mark measures 0.65 corner to corner, and the outer strokes of `l`
  and `t` are cut off on any round-masked launcher.
- **The notification icon is alpha only.** Android discards the colours of a status-bar
  icon and tints the shape, so a coloured mark arrives as a solid white blob.

Play also rejects an alpha channel on the 512² listing icon, which is why that one is
converted to RGB.

### What the config asserts

- **Three permissions are blocked.** Expo's prebuild template adds `SYSTEM_ALERT_WINDOW`
  and `READ`/`WRITE_EXTERNAL_STORAGE`; nothing here uses them, and the first is shown to
  users on the listing as "Display over other apps".
- **A production build FAILS if `EXPO_PUBLIC_TEST_SESSION` is set.** `babel-preset-expo`
  inlines every `EXPO_PUBLIC_*` var into the bundle, so the device-verification hatch
  that seeds an already-minted session and skips the login screen would ship *inside* a
  published app as an auth bypass. The build throws rather than producing it.
- **`orientation` is `'default'`, not `'portrait'`.** `ios.supportsTablet: true`
  (`sdk/org/apps/mobile/app.config.js:148`) asks for real iPad chrome, and Apple's own review
  guidance for a tablet-supporting app expects rotation to come with it — locking to portrait while
  claiming tablet support asked for one without the other. Every screen (Home, Chat, Teams) is
  Tamagui flex layout with no fixed-portrait assumption, so there was no layout reason for the lock
  either (`sdk/org/apps/mobile/app.config.js:81`). This is a NATIVE project change — `orientation`
  is baked into the generated `Info.plist`/`AndroidManifest`, and is therefore inside the
  `@expo/fingerprint` hash (see [What the fingerprint actually
  hashes](#what-the-fingerprint-actually-hashes)) — so it ships on the next store build, not an OTA.

### Building and submitting

`sdk/org/apps/mobile/eas.json` carries four build profiles and a submit profile. The
production one emits an app bundle and takes its `versionCode` from EAS rather than the
config (`sdk/org/apps/mobile/eas.json:1-38`), so the number Play orders releases by has
one owner. Submission targets the internal track as a draft
(`sdk/org/apps/mobile/eas.json:39-47`).

```bash
cd sdk/org/apps/mobile
eas login
eas build --platform android --profile preview      # APK, installable on a phone
eas build --platform android --profile production   # AAB for the store
eas submit --platform android --latest
```

**Three of the four profiles set `EXPO_OTA_APP_ID`, and that is not only about OTA.**
The variable is read by `app.config.js`, so it is inside the fingerprint and therefore
inside the `runtimeVersion` — see [What the fingerprint actually
hashes](#what-the-fingerprint-actually-hashes). A profile that omits it builds a binary
on its own runtimeVersion, unreachable by any update published for the others. `preview`
sets it (`sdk/org/apps/mobile/eas.json:13-20`) so a sideloadable APK lands on the *same*
runtimeVersion as the store bundle — which is what makes an APK a valid stand-in when
proving an update reaches a device, instead of the store bundle being the only witness to
its own OTA path. `staging` sets it plus `RELEASE_CHANNEL=staging`
(`sdk/org/apps/mobile/eas.json:21-29`), because the publish workflow offers a `staging`
branch and without a binary asking for that channel nothing could ever receive one.
`development` sets neither: a dev client loads from Metro and never asks the server.

**`babel-preset-expo` must be an explicit dependency** even though `expo` pulls it in
(`sdk/org/apps/mobile/package.json:38-44`). `babel.config.js` names it as a preset, and
under pnpm's strict layout Babel resolves presets from *its own* location in the store,
where a transitive dependency of `expo` is not reachable. `expo export` survives this —
Metro's transformer resolves the preset itself — so `pnpm bundle:android` stays green
while the Gradle release task, which is what EAS runs, dies with
`Cannot find module 'babel-preset-expo'`. The green gate does not cover the failing
path; only `./gradlew :app:bundleRelease` does.

**The workspace dependencies must be BUILT before the bundler runs**
(`sdk/org/apps/mobile/package.json:16`). Most of the shared libs are consumed as
source — `@lmthing/ui`, `auth` and `css` all export `./src/*` — but `@lmthing/core`
exports `./dist/*`, and `dist/` is gitignored. A local checkout has one from the last
`pnpm build`, so Metro resolves `@lmthing/core/ui` and every local gate is green; a
fresh EAS clone has no `dist` at all and the bundle dies with
`Unable to resolve module @lmthing/core/ui from libs/ui/src/chat/components/render-descriptor.tsx`.
`eas-build-post-install` is the hook EAS runs after installing, and
`--filter "@lmthing/mobile^..."` names the app's dependencies rather than a list that
goes stale — today that builds `@lmthing/core` and nothing else, in about four seconds.

> Neither `pnpm bundle:android` nor `pnpm test:native` can catch this. Both run against
> a tree where `dist/` already exists. The failing path is "clean clone", and the only
> honest test of it is a build on EAS.

**EAS builds from the git tree, and `sdk/org` is a submodule with its own root** — which
is what makes this work at all, since `apps/mobile` belongs to `sdk/org`'s pnpm workspace
and is deliberately absent from the repo-root one. Uncommitted changes are not uploaded;
commit before building or the build is of the last commit.

### What only the Play Console can do

The store listing needs a privacy policy URL and, because the app creates accounts, an
account-deletion URL reachable by someone who is not signed in. Both are routes on
lmthing.com (`com/src/routes/privacy.tsx#Privacy` ·
`com/src/routes/delete-account.tsx#DeleteAccount`), linked from every page's footer
(`com/src/routes/__root.tsx#Footer`) and from inside the app itself
(`sdk/org/libs/ui/src/dashboard/DashboardHome.tsx#DashboardHome`) — Play requires an
in-app route to deletion, and it lands in the shared surface so the web app carries it
too. The origin comes from the auth context rather than `crossAppOrigin`
(`sdk/org/libs/auth/src/types.ts#AuthContextValue`), which knows only the four product
surfaces and returns `''` off the web, which on a phone is not a URL.

The listing also needs: the Data safety form (the app collects identity, user content
and a device push token, sends conversation content to model providers, and runs no
analytics or advertising SDK), a content rating questionnaire, a target-audience
declaration, and — because every screen past launch is behind a login — **reviewer
credentials in App access**, or the reviewer sees only the sign-in screen.

Sign-in is GitHub SSO through an in-app browser
(`sdk/org/libs/auth/src/platform/sso.native.ts#startLogin`) or a one-time code emailed to
any address; there is no password path (`.issues/zitadel-password-login-disabled.md`).

**Neither of those is reviewable as it stands**, which is why `REVIEW_DEMO_EMAIL` /
`REVIEW_DEMO_CODE` exist — see "One address signs in with a code that was never mailed" in
[../cloud/auth.md](../cloud/auth.md).
A GitHub demo account means handing over real GitHub credentials and hoping no device
check fires; email sign-in mails the code to a mailbox the reviewer does not have. The
demo pair gives App access an actual username and password, and is revoked by blanking
one vault key. Put demo content in that workspace — it is an ordinary account, and the
credentials are written down in a form at Google.

## Over-the-air updates

The app carries an updates client (`sdk/org/apps/mobile/app.config.js:44-63`) pointed at
our own server rather than EAS Update. Two properties of that config are the whole
safety story.

**`runtimeVersion` is `fingerprint`, not `appVersion`.** An OTA can only ever replace
JavaScript. The fingerprint is a hash of the native project, so adding an Expo module or
bumping the SDK changes it automatically and the binaries already installed are simply
never offered the new bundle. Under `appVersion` the same safety depends on a person
remembering to bump `version` in the commit that changed native — and forgetting once
means every installed copy launches JavaScript whose native modules are not there, which
is a crash loop that only a store release can end.

### What the fingerprint actually hashes

Not just "the native project". `@expo/fingerprint` hashes the **resolved** Expo config,
and `app.config.js` reads two environment variables while resolving
(`sdk/org/apps/mobile/app.config.js:41-43` · `sdk/org/apps/mobile/app.config.js:104-113`),
so both are inside the runtimeVersion. Measured against this app, android, managed
workflow:

| environment | runtimeVersion |
|---|---|
| nothing set | `b6f46592…` |
| `EXPO_OTA_APP_ID` | `5d1b793a…` |
| `EXPO_OTA_APP_ID` + `RELEASE_CHANNEL=staging` | `e455f974…` |

`eas.json` itself is a fingerprint source too, under the `easBuild` reason — so editing a
build profile changes the runtimeVersion of every profile, and binaries already in the
field stop being offered new bundles until a release carries the new value out. That is
the safe direction of the failure, but it means an unrelated-looking `eas.json` edit is a
release-affecting change, not a config tidy-up.

Two rules follow, and both are silent when broken. **A publish must run with the same
variables as the build it is aimed at** — publishing with `RELEASE_CHANNEL=staging` mints
a runtimeVersion only a `staging`-profile binary has, so aiming it at production binaries
reaches nobody while the CLI reports success. And **the number to check is the one EAS
recorded for the build**, visible as `runtimeVersion` in `eas build:list --json`;
reproduce it locally with

```bash
cd sdk/org/apps/mobile
EXPO_OTA_APP_ID=… node ./node_modules/expo-updates/bin/cli.js \
  runtimeversion:resolve --platform android --workflow managed
```

`--workflow managed` is not optional: `android/` exists in a working copy after a local
prebuild and is gitignored, and hashing it would produce a runtimeVersion no EAS build
has. `eoas` resolves the workflow from VCS for the same reason.

**The manifest is signed, and the app verifies it.** `codeSigningCertificate` embeds the
public half in the binary at build time — it is compiled into the Android manifest as
`expo.modules.updates.CODE_SIGNING_CERTIFICATE`, which is why `certs/certificate.pem` is
committed and the build fails without it. Without signing, anything that can answer for
`lmthing.cloud/ota` — a hostile DNS reply on a shared network — executes code inside the
app.

**The SERVER owns the private half, and we never see it.** In control-plane mode an
Application is created with `keysConfig.mode: database`: the server generates the pair,
keeps the private key encrypted under `DB_KEYS_MASTER_KEY_B64`, and exposes only the
certificate at `GET /api/apps/{id}/certificate` — that download is what
`certs/certificate.pem` is. The dashboard refuses to provision `environment` mode at
all ("it cannot be provisioned from the dashboard"), which is the API saying the key is
not meant to travel. So the one key that can push code into every installed phone is
never in the vault, never in a Secret and never on a laptop.

`url` is compiled into the binary, so changing it is a store release, not a config
edit. It is a PATH on the gateway host rather than an `updates.` subdomain, which is
what let the server ship without a new listener pair, a cert-manager Certificate and a
DNS record: Envoy strips the `/ota` prefix and routes to the `ota` Service
(`devops/argocd/envoy/cloud-routes.yaml:141-181`), and the server's `BASE_URL` carries
the prefix back so the asset URLs it hands out return through the same rule.

The server runs in control-plane mode against its own `ota` database — that is what
buys the instant rollback, which is the reason for self-hosting rather than serving a
static manifest. Bundles land on a PVC (`STORAGE_MODE=local`) rather than a bucket: a
JS bundle is ~4.5 MB and updates are occasional (`devops/argocd/core/ota.yaml`). The
migration when that stops being true is `STORAGE_MODE=azure` plus a CDN, and nothing
else changes.

### The app id is baked in too

In control-plane mode the server will not answer a manifest request that does not say
which app it is for: it replies `No app id provided`, with no fallback. The client sends
that as an `expo-app-id` request header, which — like `url` — is compiled into the
binary. Its value is the **Application UUID from the eoas dashboard**, not the EAS
`projectId`.

A store build made without it can never receive an update, and no config change fixes
it afterwards; only a new store release does. That is the same failure as shipping with
no updates client at all, so a production build THROWS rather than producing a binary
whose OTA is quietly dead (`sdk/org/apps/mobile/app.config.js:23-40`). Set
`EXPO_OTA_APP_ID` in the production profile's env.

### Publishing

**A push to `main` that moves the submodule pointer publishes automatically.** The trigger
is the bare path `sdk/org` (`.github/workflows/ota-publish.yml:29-45`) — the app and every
lib it bundles live *inside* the submodule, which no commit in the parent repo ever
touches, so a gitlink entry is the only thing a path filter can match. That also makes the
pointer the right signal: JavaScript `main` does not point at is not what the rest of the
product is running, and has no business reaching phones ahead of it.

Automation removed the reviewer that used to stand between a merge and every installed
phone, so three things replace them:

- **The gates run first and a red one stops the publish** — typecheck, a production
  bundle, the `@lmthing/ui` suite, and the Metro native harness. The harness is there
  specifically because a broken React Native graph is invisible to `tsc` and to the jsdom
  suite, and `bundle:android` proves the app bundles, not that its screens mount.
- **It refuses to publish for a runtimeVersion no shipped binary has.**
  `apps/mobile/scripts/resolve-publish-target.mjs` resolves the fingerprint and looks it up
  in `apps/mobile/shipped-runtime-versions.json`; a miss means the commit changed the
  native project, and the run ends with an explanation instead of an update nobody can
  receive. **Add an entry to that file whenever you upload a build** — a forgotten entry
  stops publishing, which is the safe direction, but it stops it silently until someone
  reads the summary.
- **Afterwards it asks the server what a phone would get** and fails if that is not a real,
  signed, downloadable update.

The automatic path does **not** use the `production` GitHub Environment: its required
reviewer would park every push waiting for a click. Manual dispatch keeps it, and stays
the way to publish at a percentage, to `staging`, or to re-run. Rollback is still manual
and instant, and remains the actual answer to a bad bundle.

A partial rollout is never scheduled automatically — promoting one is a manual act, so an
automatic 10% would leave most devices on the old bundle until somebody remembered.

### Publishing by hand

`.github/workflows/ota-publish.yml`, manually dispatched. It is not automatic on push on
purpose: a bad bundle reaches every phone within minutes, and unlike a store release
nothing reviews it on the way. The workflow takes a branch, a rollout percentage and a
message, runs typecheck and a real bundle first, and publishes with `eoas`. The
`production` branch maps to a GitHub Environment, so a required reviewer there is the
gate between a merge and everyone's phone.

Two names matter and are easy to get wrong. `EOO_TOKEN` holds an **app-scoped API key**
(`eoo_…`) minted per app in the dashboard — not the server's `JWT_SECRET`, so the CI
credential can only publish to this one app and can be revoked without touching
anything else. And `RELEASE_CHANNEL` decides which channel's config builds INTO the
bundle; it does not choose where the update lands, which only `--branch` does. The app
config reads the same `RELEASE_CHANNEL` for the `expo-channel-name` header it compiles
into a build, so the bundle and the binary asking for it cannot drift apart.

Rolling back beats publishing a fix — it is instant, and it does not need a green build.

`--rollout-percentage` accepts **1–99**. A full rollout is expressed by omitting the flag,
not by passing `100`, which the CLI rejects before it does any work.

### A channel is not a branch, and nothing links them for you

The binary asks by **channel** (`expo-channel-name`, compiled in); `eoas publish` writes to
a **branch** (`--branch`). On a server that has never been published to, no mapping exists
between them, and the failure is not an error at publish time — the publish succeeds, and
every device asking for that channel gets `404 No branch mapping found`. The same lookup
guards `/assets`, so an unmapped channel fails the bundle download too.

The mapping is created once per channel, against the control-plane API:

```bash
# body key is channelName, NOT name — `{"name": …}` answers "Channel name is empty"
curl -X POST https://lmthing.cloud/ota/api/apps/$APP_UUID/channels \
  -H "authorization: Bearer $DASHBOARD_TOKEN" -H 'content-type: application/json' \
  -d '{"channelName":"production","branchName":"production"}'
```

### Proving an update would actually be applied, without a device

Every step below is a place the chain breaks silently in the field, and all of them are
checkable from a laptop. Send the request a device sends — the app id, the channel and the
runtime version are all required, and `expo-channel-name` must be on the **asset** request
too, not only the manifest one:

```bash
curl -sD- https://lmthing.cloud/ota/manifest \
  -H "expo-app-id: $APP_UUID" -H 'expo-channel-name: production' \
  -H "expo-runtime-version: $RTV" -H 'expo-platform: android' \
  -H 'expo-protocol-version: 1' -H 'expo-expect-signature: true' \
  -H 'accept: multipart/mixed'
```

A 200 `multipart/mixed` whose manifest part carries `expo-signature: sig="…", keyid="main"`
is the only answer that means anything. Then verify that signature against
`certs/certificate.pem` — the copy in the binary — with `crypto.verify('RSA-SHA256', …)`
over the manifest part's **raw bytes**; re-serialising the JSON invalidates it. Finally
fetch `launchAsset.url` and check its sha256 against `launchAsset.hash` (url-safe base64,
no padding). Confirmed for the first published update on 2026-07-30.

### Two reasons a correct publish is still not offered

Both look identical from the device — `NoUpdatesAvailable` — and neither is a fault.

**The embedded bundle can be newer than the update.** The selection policy takes the
newest `createdAt`, and the bundle inside a binary is stamped when that binary was BUILT.
An update published while a build sits in the EAS queue loses to the build that finishes
after it. Publish *after* the build completes, not before.

**Byte-identical bundles are deduplicated.** Republishing unchanged JS answers
`There is no change in the update for android, ignored` and deploys nothing, so a publish
cannot be used as a "poke". Only genuinely different JS produces a new update.

### What a real device proves that nothing else does

Verified on an Android 13 emulator against the shipped `production` channel, 2026-07-30:
`Manifest code signing signature verified successfully` in `dev.expo.updates` — the device
checking the manifest against the certificate compiled into its own APK — then
`DownloadComplete` / `isUpdatePending`, and on the next launch the new JavaScript running.

The unambiguous evidence is a pair of headers the client sends on every manifest request:
`Expo-Embedded-Update-Id` never changes (it is what shipped in the binary), while
`Expo-Current-Update-Id` becomes the published update's id once one has been applied. Two
ids that differ is the whole proof, and it is visible in the OTA server's own logs without
instrumenting the app. A JS-only edit does not move the runtimeVersion, so a throwaway
marker bundle can be published, observed and then replaced by republishing the clean
bundle of the same commit.
