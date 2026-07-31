# LMThing Desktop (Tauri v2) — progress

Plan: `~/.claude/plans/lets-plan-a-desktop-magical-gosling.md`

Shell = Tauri v2 · surfaces = chat + team + dashboard (mobile-app-shaped) · hybrid, phased:
Ph1 cloud pod → Ph2 bridge (local FS + local browser + DevTools agent) → Ph3 local Node sidecar.

---

## Phase 1a — shared-lib seam ✅ DONE

Everything downstream depends on this, so it landed first and standalone.

| File | Change |
|---|---|
| `sdk/org/libs/auth/src/env.ts` | **new** — `isWeb()` (moved here, one implementation), `DesktopBridge`, `DESKTOP_PROTOCOL_VERSION`, `getDesktopBridge()`, `isDesktopRun()` |
| `sdk/org/libs/auth/src/client.ts` | imports `isWeb`/`isDesktopRun` from `./env`, re-exports `isWeb`; **`isLocalRun()` now short-circuits on `isDesktopRun()`** |
| `sdk/org/libs/auth/src/index.ts` | barrel exports `isDesktopRun`, `getDesktopBridge`, `DESKTOP_PROTOCOL_VERSION`, type `DesktopBridge` |
| `sdk/org/libs/auth/src/platform/sso.ts` | `startLogin` desktop branch → `startDesktopLogin()` (system browser + `lmthing://` deep link, then the shared `exchangeSsoCode`) |
| `sdk/org/libs/ui/src/platform/api-base.ts` | `apiBase`/`wsUrl`/`cloudBaseOverride` read the injected bridge; inert in a browser |
| `sdk/org/libs/ui/src/lib/app-urls.ts` | `dataPlaneOrigin` asks the host for **both** roles — the `computer` arm was missing |
| `sdk/org/libs/auth/src/env.test.ts` | **new** — 15 tests |
| `sdk/org/libs/ui/src/platform/platform.test.ts` | +7 desktop tests |

### The three decisions worth remembering

1. **A runtime global, not a `platform/*.desktop.ts` fork.** A `.desktop.ts` sibling is invisible to
   `libs/ui/scripts/lint-native-forks.mjs` (it scans only `.native`/`.web`) — an unlisted file in
   `platform/` is the one failure mode a ratchet must not have. And the value must change at
   *runtime*: Ph3 repoints `apiBase` at a loopback sidecar with no rebuild. Precedent:
   `window.__LM_ACCESS_TOKEN__`.
2. **`isLocalRun()` keys on the injected global, NOT a `tauri:` scheme sniff.** A Tauri webview is
   `tauri://localhost` on macOS/Linux → hostname `localhost` → `AuthProvider` sets `isDemo` → the
   app booted into `DEMO_SESSION` with `accessToken: 'demo'`, no login screen, every pod call 401ing.
   Windows serves `tauri.localhost` and never matched, so the break was **silent and OS-divergent**.
   A scheme test would have re-introduced it in Ph3 local mode, against a real pod.
3. **`isWeb()` moved to `env.ts`** so `isDesktopRun()` can share the RN-shim check without a
   `client ⇄ env` import cycle. Re-exported from `client.ts`, so no import path changed.

### Verification run

- `pnpm typecheck` (whole workspace) — clean
- `pnpm test libs/auth/src/env.test.ts` — 15/15
- `libs/ui` `pnpm test src/platform/platform.test.ts` — 14/14
- `libs/ui` `pnpm test:native` (Metro graph gate) — PASS
- ratchets: `lint:tokens` `lint:imports` `lint:self-imports` `lint:tailwind` `lint:forks` `lint:dom`
  `lint-relative-transport` — all PASS
- `pnpm test` (full) — **2819 passed, 0 assertion failures**

**Pre-existing failures, confirmed not mine** (verified against `HEAD`, and by running in isolation):
- `libs/ui` `eslint .` — 27 errors, all "Definition for rule … was not found" (missing plugins) plus
  unrelated files in `studio/`, `team/`, `theme/`.
- `libs/ui` `lint:rn` — one raw `<iframe>` at `src/elements/content/app-view/view.tsx:27`, present at HEAD.
- full-suite run: 40 files fail to LOAD under concurrency (`Failed to load url quickjs-emscripten`,
  `yaml`). They pass when run directly — a parallel-resolution flake on this machine, not a defect.

> ⚠️ This worktree is shared with other Claude Code sessions. `git status` currently shows unrelated
> WIP in `scenarios/`, `apps/mobile/scripts/`, `libs/core/src/ui/readability.*`. **Commit with
> `git commit --only <paths>`**, never `-a`.

---

## Phase 1b — lift mobile-only code into `@lmthing/ui` ✅ DONE

`apps/mobile/src/ensure-pod.ts` was already the *second* fork of `apps/web/src/lib/gates.tsx`;
desktop would have been the third. Lifted before forking again.

| Change | Detail |
|---|---|
| `libs/ui/src/lib/pod-boot.ts` | **new** — `ensureComputePod`, `waitForPodEdge` |
| `libs/ui/src/team/teams.ts` | **new** — `listTeams`, `teamTokenGetter`, `teamAppUrl`, `TeamSummary` |
| `libs/ui/src/team/focus.ts` + `.test.ts` | **new** — `resolveFocusTeamId` (test moved with it, 4/4) |
| `libs/ui/src/platform/api-base{,.native}.ts` | **new `teamBase()`** on both forks + the barrel |
| `libs/ui/src/team/index.ts` | re-exports the two new modules |
| `libs/ui/package.json` | `./lib/*` now lists extensions (see below) |
| `apps/mobile/{App,src/TeamScreen}.tsx` | import from the shared barrels |
| `apps/mobile/src/{ensure-pod,team,team-focus}.ts` + test | **deleted** — no shims |
| `apps/mobile/src/hosts.ts` | `TEAM_BASE_URL` removed; it lives in the seam now |

### Deviations from the plan, and why

- **`ensureComputePod` takes no cloud-base parameter.** The plan said pass one. It doesn't need to:
  `dataPlaneOrigin('cloud')` already resolves correctly on all three targets, and on native it reads
  the *same* `EXPO_PUBLIC_CLOUD_BASE` that mobile's `CLOUD_BASE_URL` did — verified equivalent. One
  source of truth beats a parameter every host would pass the same value to. An optional
  `{ cloudBase }` override remains, for tests only.
- **`./lib/*` in `libs/ui/package.json` mapped extensionlessly** (`"./src/lib/*"`), which only ever
  worked because `apps/web` aliases `@lmthing/ui` straight to source and bypasses the exports map.
  Mobile had never imported `@lmthing/ui/lib/*`. Now listed with extensions, matching the
  `./elements/*` convention already in the same file.
- **`app-views.ts` was NOT lifted.** It is genuinely mobile-shaped (it decides native-`ViewRenderer`
  vs WebView) and the desktop answer is different (an iframe). Lifting it would have meant inventing
  a three-way abstraction before the third case existed. Left where it is.

### Verification run

- `libs/ui` + `apps/mobile` `pnpm typecheck` — clean
- `libs/ui` `pnpm test src/team/focus.test.ts` — 4/4
- all seven `libs/ui` ratchets + `lint-relative-transport` — PASS
- `apps/mobile` `lint-barrel-imports` — clean
- `libs/ui` `pnpm test:native` (Metro graph gate) — PASS
- **`npx expo export --platform android` — Android bundled, 2914 modules.** This is the one that
  matters: the graph gate builds from `metro/entries/`, NOT from `App.tsx`, so it could not have
  seen the new `@lmthing/ui/lib/pod-boot` import at all. Only the real bundle proves the exports-map
  change resolves on the native target.

---

## Phases 1c–3 ✅ DONE

Full detail is in the commit messages and in `org/docs/desktop/README.md`. The short version:

| Phase | What landed |
|---|---|
| **1c** shell | `apps/desktop` frontend, mobile-`App.tsx`-shaped, reusing `@lmthing/ui` |
| **1d** Tauri | `src-tauri`: window, deep link, config, tokens-from-`tokens.json` |
| **1e** gates | `lint:tokens` + CI + `org/docs/desktop/` + `.rs` in docs-sync |
| **polish** | Native menus, navigation containment, window state |
| **E2E** | 12 Playwright tests against the REAL bundle |
| **2a** transport | `/api/host/ws` + `HostBridge` (designated single client) |
| **2b** filesystem | `fs:local:read`/`:write`, `hostFs` yield, `grants.rs` jail, Local access pane |
| **2c** browser | Loopback MCP endpoint, real Chromium over CDP, `browser:cdp` + devtools agent |
| **3** local mode | `node:sqlite` swap, sidecar, mode toggle |

### The findings worth keeping

1. **`isLocalRun()` demo-moded macOS/Linux.** `tauri://localhost` → hostname `localhost` →
   `DEMO_SESSION` with `accessToken: 'demo'`. Silent AND OS-divergent (Windows uses
   `tauri.localhost`). Pinned by a test in both directions.
2. **`AuthProvider` took its gateway from the wrong place.** `resolveConfig` never consulted the
   bridge, so a shell pointed at a dev gateway still mailed sign-in codes from PRODUCTION. Does not
   fail visibly — it signs someone in against the wrong environment — so the E2E asserts it on the wire.
3. **`installSsoHandler` threw before `render()`.** The loudest failure in the code produced the
   quietest one a person can see: a blank window. Found by the E2E's `pageerror` guard on its first run.
4. **Two E2E assertions would have passed on a blank page.** Absence assertions now require the app
   to have rendered first.
5. **`tanstackRouter` does NOT no-op without `src/routes`** — it throws ENOENT from an async hook on
   every build while the build still succeeds. Added a `router: false` opt-out.
6. **docs-sync recognises `.rs` but classes it non-code** → Rust is line-anchor-only.
7. **Vite 5.4 predates `node:sqlite`** — strips the `node:` prefix and looks for a package called
   `sqlite`. Aliased to a `createRequire` shim.
8. **`libs/cli` now has no native dependency at all**, which also removes `node-gyp` from the pod image.

### Final verification

`3048` vitest · `34/34` cargo with `clippy -D warnings` · `12/12` Playwright · Metro graph gate ·
`expo export` · `apps/web` build · workspace typecheck · `lint:tokens` (768 files) ·
`docs:check` (5361 citations).

**Known flake, not a defect:** two suites using real worker threads fail only under full-suite
concurrency and pass 3/3 in isolation. Pre-existing on this machine.

### What is NOT proven

- A window on macOS or Windows (only Linux launched here)
- Anything against a **real pod** — every test uses a stub backend
- The CDP tool translation against real sites (`apps/desktop/src/cdp.ts` has no test of its own)
- The sidecar binary — `bundle.externalBin` is declared, no release pipeline builds it
- `desktop-release.yml` (signing, notarization, an OS matrix) does not exist

---

## Next

1. Run it on a real machine against a real pod: sign in, grant a folder, ask an agent to read it.
2. A release pipeline: OS matrix, Apple + Windows signing, the sidecar binary, an updater key.
3. The visible browser pane (screencast + input forwarding) — the CDP plumbing is in place; the
   pane that lets a person watch and take over is not.

---

## The live browser pane + a space to control it ✅ DONE

The pane the plan called *2b* and the follow-up work said was "not built". A real Chromium runs
with no window of its own and streams frames over CDP; the pane draws them and sends mouse and keys
back. Plus `system-desktop-browser` gains 17 functions and a `browse` agent that drives that same
browser.

Grounded detail: [`org/docs/desktop/browser.md`](./org/docs/desktop/browser.md).

| Change | Where |
|---|---|
| Chromium launched `--headless=new`, WS URL read from `DevToolsActivePort` | `apps/desktop/src-tauri/src/browser.rs` |
| `browser_relaunch` — same browser, same profile, a window of its own | `apps/desktop/src-tauri/src/commands.rs` |
| CDP client on the BROWSER target, flat sessions, real tabs, screencast | `apps/desktop/src/cdp.ts` |
| Pure input translation (coordinates, keys, wheel, address bar) | `apps/desktop/src/browser-input.ts` |
| One session shared by the pane and the bridge | `apps/desktop/src/browser-session.ts` |
| The pane: tabs, address bar, navigation, input, agent indicator | `apps/desktop/src/BrowserPane.tsx` |
| Both tool catalogues, translated onto CDP | `apps/desktop/src/browser-tools.ts` |
| 17 functions + `browse` agent + `browser/live` knowledge | `libs/core/system-spaces/system-desktop-browser/` |
| `LMTHING_DESKTOP_BROWSER_URL`, separate from the Lightpanda one | `libs/cli/src/host/browser-endpoint.ts` |

### Findings

1. **`bundle.externalBin` had the cargo gate red on main.** Tauri resolves external binaries at
   COMPILE time and fails on a missing one, so declaring a sidecar nothing builds broke
   `cargo test`, `cargo build` and `tauri dev` for everyone. Removed until a release pipeline
   stages the binary; `sidecar.rs` says where to put it back.
2. **`HomeShell`'s root `Box` renders `display: block`.** Every surface below it resolved `flex: 1`
   against a zero-height parent. The three shared surfaces hid it by carrying their own height; a
   raw element sized by its container does not. Found by measuring the ancestor chain after the
   pane rendered frames into a box with no size — invisible to every other gate, exactly as
   `reference-layout-collapse-invisible-to-gates` says.
3. **`fetch('/json/version')` from the webview is blocked by CORS.** Chromium's DevTools HTTP
   endpoints send no `Access-Control-Allow-Origin`; `--remote-allow-origins` governs the WebSocket
   handshake and does not help. Rust reads both the port and the socket path out of
   `DevToolsActivePort` instead, so there is no HTTP request at all.
4. **A headless page is never focused and DROPS key events.** The mouse still works, so it presents
   as "clicking is fine, typing does nothing". `Emulation.setFocusEmulationEnabled` is the fix;
   `Page.bringToFront` alone is not enough.
5. **Tab titles cannot come from target events.** `Target.targetInfoChanged` fires only on
   navigation and puts the URL in its `title`, and does not fire at all when a page sets
   `document.title` from script — verified directly against Chromium. `Target.getTargets` is the
   only source, so the strip polls it while visible, single-flight (two overlapping replies can
   land out of order and leave a stale title that nothing later corrects).
6. **Screencast frames must be acked** or Chromium stops after two or three, silently. The e2e
   requires the picture to CHANGE after navigating, which is what distinguishes a live stream from
   a frozen one.
7. **`localhost:3000` matched the address bar's scheme test** and went to the browser as the
   protocol "localhost". A scheme now needs `//` after it.
8. **`apps/desktop/src/**` was not in the vitest include list** — a suite there would have run
   nowhere, the same way `libs/ui/src/team/**` did for its whole life.
9. **The capability smoke test grouped by SPACE.** `system-desktop-browser` holds `browser:cdp` on
   `devtools` and nothing on `browse` (its function list is its gate), so the correct agent looked
   like an omission. Now an exact list of the thirteen space/agent pairs that hold capabilities.

### Verification

`3105` vitest (3 known worker-thread concurrency flakes, all pass in isolation) · `37/37` cargo with
`clippy -D warnings` and `fmt --check` · `17/17` Playwright, five of them against a REAL Chromium ·
Metro graph gate · `expo export` · `apps/web` build · workspace typecheck · `lint:tokens` (774
files) · `docs:check` (5420 citations).

### Still not proven

- Any of it against a **real pod** — the bridge, and so the agent path end to end, has only spoken
  to a stub.
- The pane under **WKWebView or WebKitGTK**. The app runs in Playwright's Chromium here.
- The **27 `system-browser` wrappers against real sites**.
- Whether **streamed scrolling is acceptable** for real work. If it is not, the fallback is an
  embedded Chromium child window — platform-specific reparenting on all three platforms.
