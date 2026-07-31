# The single-file `lmthing` executable

One downloadable file that runs the whole pod CLI on a machine with no Node, no pnpm and no checkout — with the zerostack coding agent inside it and the Lightpanda browser one command away.

Built by `node scripts/bundle/build.mjs` from `sdk/org/libs/cli`, or `pnpm --filter @lmthing/cli bundle` `sdk/org/libs/cli/package.json:19-20`.

Two CI paths, sharing one composite action so the shipping one cannot skip a check the other runs ([.github/actions/build-cli-bundle/action.yml](../../../.github/actions/build-cli-bundle/action.yml)): [cli-bundle.yml](../../../.github/workflows/cli-bundle.yml) builds every target on each push to main and leaves 14-day artifacts, and [release.yml](../../../.github/workflows/release.yml) — the one release flow, tagged `v*` — attaches them to a draft release alongside the desktop and Android builds.

Related: what the CLI *does* once it runs → [commands.md](./commands.md) · the REST surface it serves → [rest/](./rest/README.md) · the container form of the same runtime → [../devops/deploy.md](../devops/deploy.md).

---

## What it is

Node's own binary with a payload appended, using `node:sea`. `build.mjs` copies `process.execPath`, generates a blob from `scripts/bundle/launcher.cjs`, and injects it with a pinned `postject` `sdk/org/libs/cli/scripts/bundle/build.mjs#POSTJECT`.

That construction has one consequence worth stating up front: **the executable is the building host's Node, so it cannot be cross-built.** `build.mjs` refuses a non-host target rather than emitting an artifact that dies at `exec` with a format error `sdk/org/libs/cli/scripts/bundle/build.mjs:52-62`, and CI gives each target its own runner.

| | linux-x64 |
|---|---|
| executable | ~205 MB |
| ├ node runtime | ~99 MB |
| ├ payload (`.tar.gz`) | ~81 MB |
| └ of which zerostack | ~26 MB unpacked |
| extracted on first run | ~315 MB |
| first run / later runs | ~2.1 s / ~0.5 s |

---

## Targets

Five, keyed by `<node platform>-<node arch>` `sdk/org/libs/cli/scripts/bundle/targets.mjs#TARGETS`:

| Target | CI runner | zerostack | browsing |
|---|---|---|---|
| `linux-x64` | `ubuntu-22.04` | embedded | on first browse |
| `linux-arm64` | `ubuntu-22.04-arm` | embedded | on first browse |
| `darwin-x64` | `macos-13` | embedded | on first browse |
| `darwin-arm64` | `macos-14` | embedded | on first browse |
| `win32-x64` | `windows-latest` | **none** | **none** |

`ubuntu-22.04` rather than `ubuntu-latest` because glibc is forward-compatible only: a binary linked against a newer one does not start on an older distro, and says so as a bare `version 'GLIBC_2.39' not found`.

macOS artifacts are **ad-hoc signed**, not notarised — `postject` invalidates the existing signature, and an arm64 macOS binary with no valid signature will not execute at all `sdk/org/libs/cli/scripts/bundle/build.mjs:128-146`.

### Windows is a reduced target, and declares it

Neither vendored binary exists for Windows: zerostack publishes only `*-apple-darwin` and `*-unknown-linux-{gnu,musl}` assets, and Lightpanda only `{x86_64,aarch64}-{linux,macos}` `sdk/org/libs/cli/src/browser/lightpanda-install.ts#ASSETS`. The CLI itself runs there fine, so the bundle still ships — it simply carries neither the coding agent nor the browser.

That is a **declared property of the target**, not a build that quietly succeeds with a hole in it `sdk/org/libs/cli/scripts/bundle/targets.mjs#TARGETS`. Three things follow from `zerostack: false`, and each one exists so the absence surfaces as a statement rather than a crash:

- `vendorZerostack` skips the download and returns null instead of failing the build `sdk/org/libs/cli/scripts/bundle/payload.mjs#vendorZerostack`;
- the launcher leaves `LMTHING_ZEROSTACK_BIN` **unset** rather than pointing it at a file that is not there, so the endpoint reports the binary as not installed instead of failing to spawn one `sdk/org/libs/cli/scripts/bundle/launcher.cjs#main`;
- `lightpandaAssetName` returns undefined for `win32`, so the installer says upstream publishes no build rather than 404ing on a URL it invented `sdk/org/libs/cli/src/browser/lightpanda-install.ts#lightpandaAssetName`.

The CI smoke test skips the zerostack assertion by target **name** rather than making it best-effort everywhere — a check relaxed for all five would let a silently-missing binary ship on the four that do have one.

---

## Why it extracts instead of running from memory

The CLI is not a program that reads some data files — several of its core paths resolve things by **walking the filesystem at runtime**, and each walk is load-bearing:

- `defaultSystemSpaceDirs()` resolves the shipped system spaces relative to the CLI *bundle* (`dist/cli/bin.js` → `../system-spaces`), because tsup inlines `@lmthing/core` and the core package's own copy is never consulted `sdk/org/libs/core/src/spaces/system.ts#defaultSystemSpaceDirs`.
- the project-app page build walks up for the `package.json` named `@lmthing/cli`, then aliases `@app/runtime` to `<cliRoot>/src/app/runtime/index.ts` — TypeScript **source**, esbuilt per project `sdk/org/libs/cli/src/app/build/pages.ts#findCliRoot`.
- the SPA is found by walking up for a directory containing `apps/` `sdk/org/libs/cli/src/server/static-apps.ts#resolveAppDist`.

A virtual-filesystem shim would have to intercept `fs`, `require`, esbuild's own resolver *and* `execve`, failing differently in each. So `launcher.cjs` unpacks the payload once, into a cache `sdk/org/libs/cli/scripts/bundle/launcher.cjs#extractPayload`.

The payload tree therefore **mirrors the compute image's runtime stage** (`devops/argocd/compute/Dockerfile`), which is the one arrangement of these files already proven in production `sdk/org/libs/cli/scripts/bundle/payload.mjs#buildPayload`.

### The cache

`~/.cache/lmthing` (or `~/Library/Caches/lmthing` on macOS), overridable with `LMTHING_BUNDLE_CACHE` `sdk/org/libs/cli/scripts/bundle/launcher.cjs#cacheRoot`:

```
<cache>/runtime/<payload-id>/    the extracted tree; <payload-id> is its sha256
<cache>/v8/<payload-id>/         V8 bytecode cache
<cache>/lightpanda/<platform>/   the browser, once installed
```

The directory name **is the payload's content hash** `sdk/org/libs/cli/scripts/bundle/build.mjs:79-84`. Two consequences, both deliberate: an upgrade lands in a *new* directory rather than mutating one a running process is reading, and extraction races are harmless — the loser of the `rename` discards its copy, because the winner's tree is byte-identical by construction `sdk/org/libs/cli/scripts/bundle/launcher.cjs#extractPayload`. Two `lmthing` processes starting at once on a cold cache is the normal case, not an edge one.

Deleting the cache costs the next run a few seconds and nothing else.

---

## What goes in the payload

The third-party dependency set is **derived from the built bundles, never hand-listed** `sdk/org/libs/cli/scripts/bundle/payload.mjs#detectExternals`. A second copy of `tsup.config.ts`'s `external` array would drift, and drift silently — a missing external only surfaces when the one feature that needs it runs. The scan reads every bare specifier the dists actually import (24 packages at the time of writing) and pins each to the version this workspace resolves `sdk/org/libs/cli/scripts/bundle/payload.mjs#pinVersions`.

Three things that scan has to get right, each learned from a failure:

| | |
|---|---|
| **Both dists must be scanned** | `@lmthing/core` is inlined into the CLI bundle, but its own `dist/` still ships — the `worker` and `worker-load-entry` entrypoints import it as a real package — and it has externals of its own. Scanning only the CLI produced a bundle that installed, extracted and started, then died on its first import with `Cannot find package 'yaml'` `sdk/org/libs/cli/scripts/bundle/payload.mjs#detectExternals`. |
| **A `from` clause must be anchored to its keyword** | A bare `/\bfrom\s*"…"/` also matches English. The doc comment `/** Transition a scope from 'queued' to 'running'. */` in core's dist made the build demand a package named `queued` `sdk/org/libs/cli/scripts/bundle/payload.mjs#detectExternals`. |
| **Some packages are unscannable by construction** | `react-dom` is resolved by name from an *array of strings* — both the page build and the `--web` server loop over `['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client']` calling `req.resolve(pkg)` to pin one React instance `sdk/org/libs/cli/src/app/build/pages.ts:628-640`. No scan of import syntax can see that, and its absence breaks every project-app page build rather than startup `sdk/org/libs/cli/scripts/bundle/payload.mjs#UNSCANNABLE`. |

Dependencies are installed with **npm, not pnpm**, because npm produces a flat, symlink-free tree that survives being tarred and extracted anywhere; pnpm's store symlinks point outside the payload and would dangle the moment the tree moved. The `@lmthing/*` workspace packages are linked in afterwards as *relative* symlinks, for the same relocatability reason `sdk/org/libs/cli/scripts/bundle/payload.mjs#linkWorkspacePackages`.

---

## zerostack — embedded

The vendored binary is fetched at build time and unpacked into `bin/zerostack` inside the payload `sdk/org/libs/cli/scripts/bundle/payload.mjs#vendorZerostack`. The launcher points `LMTHING_ZEROSTACK_BIN` at it, which is all the endpoint needs `sdk/org/libs/cli/scripts/bundle/launcher.cjs#main`.

Pinned to an exact version, matching the compute image, and for the same reason: it executes model-authored code against the person's entire data directory, so a change in its behaviour or permission handling is not something to inherit from an unrelated rebuild `sdk/org/libs/cli/scripts/bundle/targets.mjs#ZEROSTACK_VERSION`. The **full** asset, never `zerostack-lite-*` — upstream builds the lite one with `--no-default-features`, dropping `mcp`, `subagents`, `loop` and `git-worktree`, so `zerostackLoop` would fail at the `--loop` flag with "unknown argument" rather than anything naming the cause.

It is verified with `--version` at build time rather than trusted: a truncated download otherwise ships and surfaces only when someone escalates work to zerostack inside a running pod `sdk/org/libs/cli/scripts/bundle/payload.mjs#vendorZerostack`.

What the agent surface looks like → [../system-spaces/README.md](../system-spaces/README.md).

---

## Lightpanda — fetched on first browse

Lightpanda is **not** in the executable. At ~156 MB it is larger than the Node runtime, the CLI, the SPA, the system spaces and zerostack combined, and most runs never browse.

Both obvious alternatives are worse. Downloading at startup makes every run pay for a feature it may not use. Downloading in the background and reporting "unreachable" until it lands makes the first browse of a session fail and the second succeed — which an agent reads as a flaky browser and a person reads as a broken one.

So `LIGHTPANDA_MCP_URL` is pointed at a **loopback shim** instead `sdk/org/libs/cli/src/browser/lightpanda-proxy.ts#startLightpandaProxy`. It holds the first request open while it installs and starts the real browser, then proxies that request and every one after it. Nothing downloads until an agent actually browses, and when one does, the call succeeds — it is merely slow once.

The shim stays in the path afterwards because `process.env` is snapshot-copied into each VM at injection time, so a URL republished after the browser came up would not reach any VM already running. A loopback hop is cheap next to loading a page.

### When the shim is used

`ensureLightpanda` resolves in this order `sdk/org/libs/cli/src/browser/lightpanda.ts#ensureLightpanda`:

| Situation | Outcome |
|---|---|
| `LIGHTPANDA_MCP_URL` set | that external server is used; nothing is spawned |
| a binary resolves — `LIGHTPANDA_BIN`, the bundle cache, or `PATH` | `lightpanda serve` is spawned directly, no shim |
| nothing, and this is a **bundled** run | the shim is published; the browser installs on first browse |
| nothing else | no-op; browser functions report "unreachable" with a setup hint |

The shim branch is **not** the default, and that asymmetry is deliberate `sdk/org/libs/cli/src/browser/lightpanda.ts#autoInstallEnabled`. A bundle ships without a browser and owns a cache to put one in, so installing on demand is the only way its browsing works at all. A checkout is not in that position — turning a missing binary into a silent 156 MB download during someone's dev run would be a surprise. `LIGHTPANDA_AUTO_INSTALL=1` opts a checkout in; `=0` opts a bundle out.

### Prefetching

```bash
lmthing browser install
```

Downloads it now, with progress, so the fetch happens deliberately — on a good connection, before a flight — rather than mid-turn `sdk/org/libs/cli/src/cli/args.ts#CliArgs.browserInstall`.

### How failure reaches the agent

As a JSON-RPC `error` on an HTTP **200**, never as an HTTP status `sdk/org/libs/cli/src/browser/lightpanda-proxy.ts#rpcError`. The `system-browser` wrappers surface `rpc.error.message` verbatim but flatten any non-2xx into `lightpanda MCP returned HTTP 503` `sdk/org/libs/core/system-spaces/system-browser/functions/goto.ts:26-28` — which would tell an agent that a server rejected its call, when the truth is that a download failed. The message is the only channel that carries the actual cause:

```json
{"jsonrpc":"2.0","id":42,"error":{"code":-32001,
 "message":"download failed: HTTP 403 Forbidden — browsing is unavailable until this is resolved"}}
```

### There is no version to pin

Upstream publishes a single rolling `nightly` tag and overwrites its assets in place. Rather than imply a pin it does not have, the installer records the sha256 of whatever it actually fetched beside the binary `sdk/org/libs/cli/src/browser/lightpanda-install.ts#installLightpanda`.

A truncated download is the failure that matters here — the file exists, is executable, and dies at `exec` with a message about a bad ELF header. The installer checks the received length against `content-length` before anything is allowed to run it, and publishes atomically via `rename` so no reader ever sees a partially-written browser `sdk/org/libs/cli/src/browser/lightpanda-install.ts#installLightpanda`.

---

## Environment

| Variable | Effect |
|---|---|
| `LMTHING_BUNDLE_CACHE` | where the payload extracts; for read-only homes and CI `sdk/org/libs/cli/scripts/bundle/launcher.cjs#cacheRoot` |
| `LMTHING_BUNDLE_ROOT` | published *by* the launcher — the extracted tree, and what marks a run as bundled |
| `LMTHING_CACHE_ROOT` | published *by* the launcher, so the browser installs beside the runtime rather than in a second directory computed by slightly different rules `sdk/org/libs/cli/src/browser/lightpanda-install.ts#cacheRoot` |
| `LIGHTPANDA_AUTO_INSTALL` | `1` opts a checkout into on-demand install; `0` opts a bundle out |
| `LMTHING_LIGHTPANDA_URL` | override the download URL `sdk/org/libs/cli/src/browser/lightpanda-install.ts#lightpandaDownloadUrl` |
| `LMTHING_ZEROSTACK_BIN` | set by the launcher to the embedded binary; overridable |

Everything in [commands.md](./commands.md) applies unchanged — the bundle is the same CLI.

---

## What CI proves

`cli-bundle.yml` runs a cheap gate on pull requests (typecheck plus the browser-install and shim tests) and builds every executable on pushes to main. Each one is then **run**, from an empty working directory and a cold cache — the state a person who just downloaded it is in — and required to `init`, serve `/api/projects`, return the SPA at `/chat`, and (where upstream ships one) log a zerostack version, which is the proof the vendored binary survived tar, extraction and the executable bit ([.github/actions/build-cli-bundle/action.yml](../../../.github/actions/build-cli-bundle/action.yml)).

That distinction is the point: a build proving it can *assemble* an executable is not the same as the executable working. The payload can be missing a package that only one code path imports — which is exactly how the `yaml` and `quickjs-emscripten` gaps above were found, by running the binary rather than by building it.
