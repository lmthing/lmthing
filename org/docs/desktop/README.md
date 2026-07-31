# `desktop/` — the LMThing desktop app (Tauri v2)

A native window running the **same shared surfaces** as the web SPA and the phone: chat, teams, and the Home dashboard. It is not a fourth product. It is a fourth host for `@lmthing/ui`.

Package: `sdk/org/apps/desktop` (`sdk/org/apps/desktop/package.json:L2`). It lives in `sdk/org`'s own workspace, which already globs `apps/*` (`sdk/org/pnpm-workspace.yaml:L1-L4`), and deliberately **not** in the root workspace — the same placement `apps/mobile` has, for the reason the root `pnpm-workspace.yaml` states about staging manifests by name.

> **Status.** Phases 1, 2 and 3 are implemented and gated. The Rust compiles clean under
> `clippy -D warnings` with 34 unit tests; the app has a 12-test end-to-end suite. What has **not**
> happened is a run on a real device against a real pod — see [What is not yet proven](#what-is-not-yet-proven).

---

## Why it exists

Every other client is sandboxed by a browser or a phone. Neither can reach the user's filesystem, and neither can give an agent a browser that is *logged in as the user*. Those two capabilities are the whole reason for a desktop build; the chat/team/dashboard shell is what carries them.

They arrive in Phase 2. Phase 1 exists to make the shell real first.

---

## The governing invariant

**Screens live in `@lmthing/ui`. This app owns the provider, the boot order, and the window.**

A screen written inside `apps/desktop/src` would be a fork of the product wearing an import path — invisible to every gate in the repo. `sdk/org/apps/desktop/scripts/lint-barrel-imports.mjs` enforces it by refusing any import into a shared package's internals (`@lmthing/ui/src/...`), exactly as the mobile shell's copy does.

What the shell legitimately owns:

| File | Owns |
|---|---|
| `sdk/org/apps/desktop/src/main.tsx#boot` | Boot order: install the SSO handler, `await hydrateAuth()`, then mount |
| `sdk/org/apps/desktop/src/App.tsx#App` | `TamaguiProvider` + `AuthProvider` + the OS colour-scheme subscription |
| `sdk/org/apps/desktop/src/AuthGate.tsx#AuthGate` | The states shown while the pod wakes |
| `sdk/org/apps/desktop/src/HomeShell.tsx#HomeShell` | Three panes mounted at once, two hidden |
| `sdk/org/apps/desktop/src/TeamScreen.tsx#TeamScreen` | The host `TeamChannelsView` needs: pod URL, channel/rail state, app URL |
| `sdk/org/apps/desktop/src/desktop.ts#installSsoHandler` | The one place Tauri JS plugins are imported |

`HomeShell` mounts Home, Chat and Teams simultaneously and hides two with `display: none` rather than unmounting them: `ChatShell` holds a live WebSocket and a transcript, and `TeamScreen` holds one to the team's pod. Unmounting on every glance at Home would drop a streaming turn mid-sentence.

---

## The origin problem, and the bridge

A Tauri webview serves the bundle from `tauri://localhost` (macOS/Linux) or `http://tauri.localhost` (Windows). That origin is not the pod, not the gateway, and not a useful base for anything — so every answer the web build normally derives from `window.location` has to come from the host instead.

The host supplies it as a **runtime global**, `window.__LMTHING_DESKTOP__`, declared at `sdk/org/libs/auth/src/env.ts#DesktopBridge` and read through `sdk/org/libs/auth/src/env.ts#getDesktopBridge`. Rust injects the data half before any page script runs (`sdk/org/apps/desktop/src-tauri/src/config.rs:L36-L52`, applied via `initialization_script` in `sdk/org/apps/desktop/src-tauri/src/lib.rs`); the bundle attaches the behaviour half (`startSso`) in `sdk/org/apps/desktop/src/desktop.ts#installSsoHandler`, which keeps every Tauri import out of the shared libraries.

A bridge announcing an unrecognised `protocolVersion` is ignored **wholesale** (`sdk/org/libs/auth/src/env.ts#getDesktopBridge`), so a shell and a bundle that disagree degrade to "not desktop" rather than to a half-understood object.

### Why a runtime global and not a `platform/*.desktop.ts` fork

1. A `.desktop.ts` sibling would be **invisible to the fork ratchet** — `sdk/org/libs/ui/scripts/lint-native-forks.mjs` scans only `.native`/`.web`. An unlisted, unreasoned-about file in `platform/` is the one failure mode a ratchet must not have.
2. The value must change at **runtime**: local mode repoints `apiBase` at a loopback sidecar with no rebuild.
3. The precedent already exists — the pod bootstrap injects `window.__LM_ACCESS_TOKEN__`, read by `sdk/org/libs/auth/src/client.ts#getPodInjectedToken`.

The three shared readers:

| Reader | Behaviour |
|---|---|
| `sdk/org/libs/ui/src/platform/api-base.ts#apiBase` | The injected origin, else `''` (same-origin, unchanged on web) |
| `sdk/org/libs/ui/src/platform/api-base.ts#wsUrl` | Derived from the bridge; the `location.protocol` fallthrough would build `ws://localhost…` under `tauri://` |
| `sdk/org/libs/ui/src/lib/app-urls.ts#dataPlaneOrigin` | Asks the host for **both** roles — the `computer` arm used to be missing |

---

## The demo-mode landmine

`sdk/org/libs/auth/src/client.ts#isLocalRun` returns `false` for the desktop shell, checked **first**.

Without that branch: a Tauri webview on macOS/Linux has `location.hostname === 'localhost'`, so `isLocalRun()` was true, `AuthProvider` set `isDemo`, and the app booted straight into `DEMO_SESSION` with `accessToken: 'demo'` — the login screen never appeared and every pod call 401'd. Windows serves from `tauri.localhost`, which did not match, so the break was **silent and OS-divergent**: it reads as "auth is broken on Mac" when auth was in fact never asked for.

The test is `isDesktopRun()` — the explicit injected global — and deliberately **not** a `tauri:` scheme sniff, because local mode points the same webview at a real `http://127.0.0.1:<port>`. A scheme test would reinstate the bug exactly there, against a pod with real data. Pinned by `sdk/org/libs/auth/src/env.test.ts`.

---

## Sign-in

**Primary: the passwordless email code.** `sdk/org/libs/auth/src/email-login.ts#requestEmailCode` and `#verifyEmailCode` are two plain fetches with no browser hop, and the shared `LoginScreen` already drives them. The magic *link* is not usable — its `redirect_uri` is validated against an http/https allowlist — so, as on the phone, the person types the six digits.

**Secondary: GitHub SSO over `lmthing://`.** `sdk/org/libs/auth/src/platform/sso.ts#startLogin` takes a desktop branch into `startDesktopLogin`, which opens the system browser and waits for the deep link. This is not an optimisation: on web the page unloading *is* the mechanism, but a Tauri window has nowhere to come back from — assigning `location.href` navigates the single webview off the bundle and the app is gone until the user force-quits.

It needs **no gateway change**. `/sso/create` stores `redirect_uri` verbatim and requires an exact match with no allowlist — the same property `sdk/org/libs/auth/src/platform/sso.native.ts` already documents and relies on — so a custom scheme round-trips byte-identically.

On Linux and Windows the OS answers a `lmthing://` callback by **launching a second copy** of the app with the URL in argv, so `tauri-plugin-single-instance` is required rather than optional (`sdk/org/apps/desktop/src-tauri/Cargo.toml`); without it the callback lands in a process with no pending login while the visible window waits out its timeout.

Session storage needs no work: `localStorage` exists in a Tauri webview and persists per-origin, so `sdk/org/libs/auth/src/platform/session-store.ts` is used unchanged and `getSession()` stays synchronous.

---

## Build

`sdk/org/apps/desktop/vite.config.ts` reuses the shared factory `sdk/org/libs/utils/src/vite.mjs#createViteConfig` with three deviations, all forced by the host rather than chosen:

- **`base: './'`** — Vite's default absolute `/assets/…` URLs do not resolve over a custom protocol.
- **`build.target: ['es2022','safari16','chrome110']`** — the renderer is the OS webview, not Chrome. That is the declared floor: macOS 13+, Ubuntu 22.04+/WebKitGTK 2.36+, Windows 10 1809+ with Evergreen WebView2.
- **`router: false`** — this app has no router; its panes are a window's state. With no `src/routes` directory the generator does not no-op, it throws `ENOENT` from an async hook on every build while the build still succeeds, so the plugin is omitted instead.

`base` and `build` are passed through by the factory only when a caller sets them, so every existing app's config is unchanged.

**Colours never appear as literals.** `sdk/org/apps/desktop/scripts/generate-tauri-conf.mjs` reads `sdk/org/libs/css/src/tokens/tokens.json` and writes `sdk/org/apps/desktop/src-tauri/tokens.generated.json`, which `sdk/org/apps/desktop/src-tauri/src/config.rs:L88-L112` reads via `include_str!`. This is the same rule `lint:tokens` enforces on `src/`, applied by hand because that linter does not read Rust or packaging config — and the same reason `sdk/org/apps/mobile/app.config.js` is a `.js` file rather than an `app.json`.

---

## What is not yet proven

Stated plainly because a doc that implies otherwise is worse than no doc.

| Proven | How |
|---|---|
| The TypeScript typechecks | `pnpm --filter @lmthing/desktop typecheck` |
| The bundle builds, with relative asset paths | `pnpm --filter @lmthing/desktop build` |
| No raw colours | root `pnpm lint:tokens` (now includes `sdk/org/apps/desktop/src`) |
| No fork of the product | `node sdk/org/apps/desktop/scripts/lint-barrel-imports.mjs` |
| The seam does not break web or native | `libs/ui` `pnpm test:native` + `npx expo export` + the full vitest suite |

| The Rust compiles, lints and passes its tests | `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` (34) |
| The grant jail refuses what it must | 16 tests including symlink escape, a symlink named `notes.md` pointing at `.ssh/id_rsa`, and a sibling whose name merely starts with the grant's |
| The app boots, signs in, and drives its surfaces | 17 Playwright tests against the real bundle |
| The bridge protocol round-trips | Two of those: dial → push grants → answer an `fs.request` → log it |
| A real Chromium streams into the pane, and takes clicks and keys back | 5 Playwright tests against a genuine browser — see [browser.md](./browser.md) |

| **Not proven** | Why |
|---|---|
| A window opens on macOS or Windows | Only Linux has been launched here |
| The `lmthing://` round trip | Needs a packaged app and an OS scheme registration |
| Rendering under WKWebView / WebKitGTK | The Tamagui runtime is more JS-feature-hungry than extracted CSS; only a real webview can answer this |
| Anything against a REAL pod | Every test uses a stub backend. Sign-in, pod wake and the bridge have never spoken to production. |
| The 27 `system-browser` wrappers against real sites | Their translation is unit-tested; no live site has been driven through them — see [browser.md](./browser.md) |
| The sidecar | No release pipeline builds the binary yet, so `bundle.externalBin` is deliberately NOT declared: Tauri resolves external binaries at compile time and fails the build on a missing one (`sdk/org/apps/desktop/src-tauri/src/sidecar.rs:L21-L33`) |

---

## Phase 2 and 3 (planned, not built)

**Phase 2 — the bridge.** One WebSocket, dialled *by the desktop* (a cloud pod cannot reach a machine behind NAT), carrying three payload families: local filesystem, the browser, and raw CDP. It reuses the reverse-RPC shape that already exists in `sdk/org/libs/cli/src/rpc/server.ts` — `WebRenderHost.ask` already has a server initiate a request, carry a correlation id, and await a client reply that suspends the agent's VM turn.

The filesystem is **granted folders only**, and the jail is the entire security boundary: it lives on the desktop, in Rust, because the pod is the party running the untrusted instruction. Prompt injection — not a stolen token — is the realistic attack.

The browser reuses `system-browser`'s 27 existing agent functions unchanged, since they all speak one JSON-RPC `tools/call` shape to one URL. A desktop-only agent additionally gets raw CDP, which is the most dangerous capability in the whole design and is gated hardest. The built result — a real Chromium visible in the app, its own 17-function agent surface, and the protocol details that are easy to get silently wrong — is **[browser.md](./browser.md)**.

**Phase 3 — local mode.** A bundled Node sidecar running `lmthing serve`, with `apiBase` repointed at loopback. The native-module cost is far smaller than it looks: `better-sqlite3` is imported in exactly one file (`sdk/org/libs/cli/src/app/store.ts`) and Node 24's built-in `node:sqlite` replaces it, while `node-pty` is already a lazy import and simply need not ship.

Full design: the approved plan at `~/.claude/plans/lets-plan-a-desktop-magical-gosling.md`, progress at `PROGRESS-desktop.md`.
