# Team surface — mobile, notifications, Android

Started 2026-07-27. Follows `sdk/org b303640` (handles, categories, DMs, thread rail, apps
beside a channel).

Two scope decisions taken by the user (AskUserQuestion, both maximal):

- **Android route:** a NATIVE surface in `@lmthing/ui`, not a PWA and not a WebView wrapper.
  This is what the repo's own architecture already calls for — `apps/mobile`'s docstring says
  screens live in the shared package and `scripts/lint-barrel-imports.mjs` enforces it.
- **Notifications:** FULL push, delivered with the app closed. Needs credentials
  (VAPID or Firebase), a gateway subscription store, a send endpoint and pod egress.

## Order, and why

Each layer is a prerequisite of the next, so this is a chain rather than a fan-out:

1. **Read state** — nothing can notify without knowing what is unread. Also what the badges
   read from, and what stops a push firing for a message you are already looking at.
2. **Responsive web** — the layout decisions (one pane at a time, drawer, overlay rail) are
   the same ones the native surface needs, so making them on web first means making them once.
3. **Push infra** — gateway store + send path, then the web client (service worker), then the
   native client (expo-notifications). One server contract, two transports.
4. **Native surface** — port to platform-neutral shared components, then mount in Expo.

## Status

| # | Step | State |
|---|---|---|
| 1 | Pod: read state, unread + mention counts | ✅ 141 tests green (`team-reads.ts`, `team-push.ts`) |
| 2 | Web: unread badges + title badge | ✅ two-level (bold / count), mark-read on open, `(2) lmthing` title — verified on the rig |
| 3 | Web: responsive team surface | ✅ `useMedia` (works on native too); drawer + full-screen rail under 1024/768 — verified at 390×844 and back |
| 4 | Push: gateway subscription store + send endpoint | ✅ `push_subscriptions` + web/expo transports, 20 gateway tests |
| 5 | Push: web service worker + subscribe flow | ✅ sw.js, real PWA manifest, Settings toggle (degrades to "not configured") |
| 6 | Native: channels surface → `@lmthing/ui` | ✅ one source; web renders from it; Metro gate + a new render suite green on ios AND android |
| 7 | Native: Android app + expo-notifications | ✅ code complete (Teams is a real pane, FCM registration); ⚠️ needs `pnpm install` + an EAS build to run on a device |

## Verification

The local rig from the previous session is the harness (see the `reference-local-team-pod-rig`
memory): a proxy on :5199 that plays BOTH Envoy (identity headers a team pod trusts and cannot
fabricate itself) and the gateway (`/api/teams/*` stubs), in front of a real team-mode pod.
`?as=ana|bo|cai` switches user, so two browser contexts are two real users.

Native has its own gate that a jsdom test cannot stand in for: `pnpm test:native` runs the Metro
graph gate and the native render suites (`libs/ui/metro/README.md`). A surface that only passes
vitest has not been shown to work on the native target.

## What the native port had to solve

- **Icons.** `lucide-react` renders DOM `<svg>`. `@tamagui/lucide-icons-2` is declared in
  `libs/ui/package.json` but is NOT installed, so importing it does not resolve. Drawn with the
  SVG primitives instead (`libs/ui/src/team/icons.tsx`) — they exist for exactly this, web
  components named to mirror `react-native-svg` with a native fork that re-exports them.
- **Routing.** The shared view is prop-driven and router-free. Web keeps channel + rail in the
  URL (so links paste); mobile keeps them in state (it has no URL).
- **The app pane.** `app-view.tsx` (iframe) / `app-view.native.tsx` (WebView) — a real platform
  seam, because a project app is a separately built web bundle either way.
- **The transport.** `createTeamClient({baseUrl, getToken})`: same-origin on web, absolute on
  native. `fetch` and `WebSocket` are all it uses, and RN has both.
- **The document title.** Reported to the host as a mention count, not applied — native has no
  `document`.

Two SHARED-component defects the new render suite found, which affected every native consumer
and not just this surface:

- `Button` put a bare string child into a `Pressable` (a `View` on native). React Native drops
  the string with a warning, so `<Button><Plus/> New category</Button>` was a lone `+` on a
  device. Fixed in `Button`, not per call site.
- `AvatarFallback` rendered its initials into a `Box`. Same failure — the avatars were blank
  tinted circles. Now a `Text`.

## Open questions / risks

- **Push credentials are not provisioned.** VAPID keys / a Firebase project do not exist yet.
  The server contract and both clients can be built and unit-tested without them, but the
  end-to-end "phone buzzes with the app closed" step is blocked on real credentials.
- `docs:check` currently fails on 13 pre-existing citations (the in-flight Tamagui migration WIP
  deleted files the docs still cite). Not caused by this work; do not "fix" by rewriting those.
- The working tree carries an unrelated in-flight Tamagui/mobile migration. Stage explicitly;
  never `git add -A`.
