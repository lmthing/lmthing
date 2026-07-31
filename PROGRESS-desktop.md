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

## Phase 1c — `sdk/org/apps/desktop` frontend ✅ DONE

`package.json` · `vite.config.ts` · `index.html` · `tsconfig.json` ·
`src/{main,App,AuthGate,HomeShell,TeamScreen,AppScreen,OfflineBanner}.tsx` · `src/desktop.ts` ·
`scripts/lint-barrel-imports.mjs` (copied from mobile — the gate that keeps this a shell).

Mobile-`App.tsx`-shaped. RN-isms mapped: `useColorScheme()`→`matchMedia`, `AppState`→
`visibilitychange`, `Alert.alert`→a shared dialog, `Linking.openURL`→`@tauri-apps/plugin-opener`.
No `SafeAreaView`/`KeyboardAvoidingView`/`StatusBar` — a window has no notch and its keyboard does
not cover the app. `AppScreen` reuses `@lmthing/ui`'s `AppView` (whose web fork is already the
justified `<iframe>`) instead of writing a second one.

### Three factory changes, all zero-delta for existing callers

`libs/utils/src/vite.mjs#createViteConfig` only passed through `plugins`/`resolve.alias`/`server`/
`define`. Added, guarded on `!== undefined`:
- **`base`** — Tauri serves over a custom protocol; absolute `/assets/…` do not resolve there.
- **`build`** — the renderer is the OS webview, not Chrome, so the target must be pinned.
- **`router: false` opt-out** — the plan assumed `tanstackRouter` no-ops without `src/routes`. **It
  does not**: it throws `ENOENT: scandir …/src/routes` from an async hook on every build while the
  build still succeeds. An error that is printed but not fatal is the worst of both.

`apps/web` rebuilt byte-clean afterwards, confirming the passthrough is inert.

### tsconfig: `strict: false`, deliberately

Shared `@lmthing/{ui,auth}` source ships with no build step, so every consumer typechecks it inside
its own program. `apps/mobile/tsconfig.json` documents the convention and `libs/ui`/`apps/web`
follow it. A stricter desktop config just re-reports the libraries' pre-existing findings under a
different package's name — noise, not a gate. This app's own code is strict-clean regardless.

## Phase 1d — Tauri Rust shell ⚠️ WRITTEN, NOT COMPILED

`src-tauri/{Cargo.toml,build.rs,tauri.conf.json,capabilities/default.json}` ·
`src-tauri/src/{main,lib,config}.rs` · `scripts/generate-tauri-conf.mjs` · icons (generated from
`common/favicon.ico/web-app-manifest-512x512.png` via `tauri icon`, iOS/Android sets pruned).

- **`tauri-plugin-single-instance` is required on Linux/Windows, not optional.** Those OSes answer a
  `lmthing://` callback by launching a SECOND COPY with the URL in argv; without it the callback
  lands in a process with no pending login while the visible window waits out its 5-minute timeout.
- **No hex in a committed file.** `generate-tauri-conf.mjs` reads `tokens.json` → committed
  `src-tauri/tokens.generated.json` → `config.rs` via `include_str!`. `lint:tokens` scans `src/`,
  not Rust or packaging config, so this is the same rule applied by hand — the reason
  `apps/mobile/app.config.js` is a `.js` and not an `app.json`. CI re-runs the generator and fails
  on a diff, because `include_str!` would happily compile a stale file.
- **`config.rs` `PROTOCOL_VERSION` must equal `DESKTOP_PROTOCOL_VERSION`** in `libs/auth/src/env.ts`.

### Toolchain — installed, but the host cannot supply WebKit

`rustup` + `rustc`/`cargo` **1.97.1** + `clippy` + `rustfmt` are installed (user-local, `~/.cargo`,
no sudo). `cargo fmt --check` found 4 issues; fixed, now passes.

**`config.rs` is fully verified**, compiled and tested standalone in a scratch crate (it depends only
on `serde`, not on `tauri`): **3/3 tests pass**, including the one asserting the emitted JSON really
is `{"protocolVersion":1,"apiBase":…,"cloudBase":…,"teamBase":…}` — i.e. the Rust↔TS bridge contract
is checked from both ends, which is the most drift-prone seam in the design.

**The host cannot install `libwebkit2gtk-4.1-dev`, and it is not a Tauri problem.** This machine is
**Zorin OS 18.1 = Ubuntu 24.04 (noble)**, but it has *jammy* repos enabled alongside noble and a
**jammy webkit installed over the noble one**:

```
libwebkit2gtk-4.1-0    installed 2.50.4-0ubuntu0.22.04.1   (jammy build, dpkg status only, prio 100)
libwebkit2gtk-4.1-dev  candidate 2.44.0-2                  (noble/universe — the only one offered)
```

No repo carries a 2.50.4 `-dev`, so apt reports "held broken packages". Aligning the runtime down to
noble's own `2.44.0-2` would fix it, but `yelp`, `evolution` and `libedataserverui` link against it,
so that is a **system-level decision, not a build step** — left to the user.

**Workaround in use: Docker** (`rust:1-bookworm` + the WebKit dev packages, `CARGO_TARGET_DIR`
redirected out of the repo). Zero host risk, and the same thing `.github/workflows/desktop.yml`'s
`rust` job does on a clean runner.

## Phase 1e — gates, CI, docs ✅ DONE

| Gate | Change |
|---|---|
| root `package.json` `lint:tokens` | `+ sdk/org/apps/desktop/src` |
| `.github/workflows/design-tokens.yml` | the SAME list (its own comment demands they match) — verified identical |
| `org/docs/tools/docs-sync/citations.mjs` | extensions `+ rs\|toml` |
| `.github/workflows/desktop.yml` | **new** — `frontend` (node, fast) + `rust` (apt + toolchain) |
| `org/docs/desktop/README.md` | **new** |
| `org/docs/{README,SYNC,architecture}.md` | desktop rows — **and mobile's, which was orphaned** |

**`sdk` was already in `KNOWN_ROOTS`**, so `sdk/org/apps/desktop/src-tauri/**` citations resolve
with no change there — a top-level `desktop/` dir would have needed one.

**Answered the plan's open question:** docs-sync now *recognises* `.rs` but classifies it as a
non-code file — `symbol anchor on non-code file (.rs); use a line anchor`. So **Rust is
line-anchor-only**, which matters most for Phase 2's `grants.rs`.

**The docs gate caught a real regression I had shipped:** the Phase 1b lift broke five citations in
`org/docs/mobile/README.md` pointing at the three deleted files. Repointed to their new homes. This
is exactly the "a code change is not done until the matching `org/docs` page is updated in the same
change" rule doing its job.

---

## Final verification (everything except Rust)

| Check | Result |
|---|---|
| `pnpm test` (full, from `sdk/org`) | **224 files, 3014 tests, 0 failures** |
| `pnpm typecheck` (workspace) · `libs/ui` · `apps/mobile` · `apps/desktop` | clean |
| `libs/ui` `pnpm test:native` (Metro graph gate) | PASS |
| `npx expo export --platform android` | bundled, 2914 modules |
| `apps/desktop` `pnpm build` | 2266 modules; `./assets/…` confirms `base: './'` |
| `apps/web` `pnpm build` | unchanged |
| root `pnpm lint:tokens` | 765 files, 0 violations |
| root `pnpm docs:check` | 124 docs, 5361 citations, all resolve |
| all seven `libs/ui` ratchets + both barrel lints | PASS |

The earlier full-suite run showed 40 files failing to LOAD under concurrency; this run is fully
green, confirming that was a parallel-resolution flake on this machine and not a defect.

**Still pre-existing and NOT mine** (verified at `HEAD`): `libs/ui` `eslint .` (27 errors, mostly
"Definition for rule … was not found") and `libs/ui` `lint:rn` (one raw `<iframe>` at
`src/elements/content/app-view/view.tsx:27`).

---

## Next

1. **Install the Rust toolchain and compile `src-tauri`** — needs `rustup` + `sudo apt install
   libwebkit2gtk-4.1-dev librsvg2-dev`. Then `cargo fmt --check`, `cargo clippy -D warnings`,
   `cargo test`, and `pnpm tauri dev` to see a window.
2. Live-verify Phase 1: email sign-in → pod wake → chat streams → team channels stream, against a
   **packaged** build (the demo-mode landmine only reproduces there if `isLocalRun` is ever keyed on
   the scheme rather than the global).
3. Phase 2 — the bridge.
