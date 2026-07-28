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
  `sdk/org/libs/ui/metro/suites/chat-shell.tsx`.

## Device verification

Verified on an Android emulator (`Small_Phone_API_33`, Expo Go) against the
**production** gateway and a live compute pod, 2026-07-27:

- an authenticated session boots the app straight into chat;
- `compute/ensure` + the edge poll wake a scaled-to-zero pod and mount
  `ChatShell`;
- the sidebar, drawer, transcript and composer all render;
- a message typed on the device reaches the pod, runs a turn, and the agent's
  reply streams back into the transcript.

Still **not** proven on a device, and stated as a gap rather than implied:

- a real interactive SSO login end-to-end (password login is disabled —
  `.issues/zitadel-password-login-disabled.md` — so verification used an
  already-minted gateway session);
- the `lmthing://` scheme being registered and its redirect intercepted
  (`sdk/org/apps/mobile/app.json` declares the scheme);
- the Android back gesture dismissing an overlay
  (`sdk/org/libs/ui/src/platform/keyboard.native.ts`);
- transcript **scrolling**. The chat transcript is a `Box`, not a `ScrollView`,
  so the DOM `scrollIntoView` auto-follow is inert on native and deliberately
  degrades rather than throwing
  (`sdk/org/libs/ui/src/chat/app/ChatView.tsx`). Porting it is its own change.
