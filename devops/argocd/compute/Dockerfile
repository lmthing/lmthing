# Build context note: the Docker build context must be the sdk/org submodule root
# (i.e. `docker build -f devops/argocd/compute/Dockerfile sdk/org/`).
# ArgoCD / CI should set the build context to the sdk/org directory so that
# the COPY instructions below resolve correctly.
#
# Build strategy: build from source with tsup inside the image.
# Rationale: tsup + pnpm produce a fast, repeatable build; shipping dist/ from CI
# would require committing build artefacts or a multi-stage CI artifact handoff.
# The build stage is discarded — only the runtime stage is pushed to ACR.
#
# Self-contained app: the shared @lmthing/{ui,css,state,auth,utils} libs live
# under sdk/org/libs (inside this submodule), so the unified web Vite app
# (studio/computer/chat as client-side routes) can be built here and served by
# `lmthing serve`. Its built dist lands at /app/packages/ui/apps/web/dist.
#
# QuickJS WASM note: quickjs-emscripten ships its own .wasm file inside the npm
# package (node_modules/quickjs-emscripten/…/quickjs.wasm). Node resolves and
# serves it at runtime without any extra configuration; no copy or WASM_PATH
# override is needed because the package uses a synchronous inline-base64 variant
# by default (quickjs-emscripten's "sync" build). If a future upgrade switches to
# the async split-WASM variant, set QUICKJS_WASM_PATH at container startup to
# point at the extracted .wasm alongside the built JS.

# ---------------------------------------------------------------------------
# Stage 1 — builder
# ---------------------------------------------------------------------------
FROM node:24-slim AS builder

WORKDIR /build

# Enable corepack so the pnpm version pinned by package.json#packageManager is
# used for installs and `pnpm exec` lookups.
RUN corepack enable

# Install git (needed for pnpm install with git dependencies), the native build
# toolchain (python3/make/g++) required to compile node-pty for the PTY terminal
# exposed over /api/ws, and ca-certificates (vite-plus, a Rust binary, reads the
# system CA store when building the Vite apps).
RUN apt-get update && apt-get install -y git python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first so dependency installation is cached separately
# from source changes. Every workspace package.json must be present so pnpm can
# resolve the full workspace graph (runtime packages + libs + the Vite apps).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/cli/package.json  ./packages/cli/package.json
COPY packages/ui/package.json   ./packages/ui/package.json
COPY libs/auth/package.json     ./libs/auth/package.json
COPY libs/css/package.json      ./libs/css/package.json
COPY libs/state/package.json    ./libs/state/package.json
COPY libs/ui/package.json       ./libs/ui/package.json
COPY libs/utils/package.json    ./libs/utils/package.json
COPY packages/ui/apps/web/package.json      ./packages/ui/apps/web/package.json

# Install all workspace dependencies (dev deps needed for tsup + vite builds).
# The checked-in pnpm-lock.yaml is the source of truth; --frozen-lockfile
# guarantees reproducible installs.
RUN pnpm install --frozen-lockfile

# Copy source for the runtime packages we need to build
COPY packages/core/src     ./packages/core/src
COPY packages/core/tsup.config.ts ./packages/core/tsup.config.ts
COPY packages/core/tsconfig.json  ./packages/core/tsconfig.json
# system-spaces are read at runtime relative to the built core dist directory;
# copy them alongside the source so they land in the correct position after build.
COPY packages/core/system-spaces ./packages/core/system-spaces

COPY packages/cli/src      ./packages/cli/src
COPY packages/cli/tsup.config.ts ./packages/cli/tsup.config.ts
COPY packages/cli/tsconfig.json  ./packages/cli/tsconfig.json

# @lmthing/agent-ui (packages/ui) is a dependency of @lmthing/cli (web
# observability surface) and of the three Vite apps built below.
COPY packages/ui/src       ./packages/ui/src
COPY packages/ui/tsup.config.ts  ./packages/ui/tsup.config.ts
COPY packages/ui/tsconfig.json   ./packages/ui/tsconfig.json

# Build the runtime packages in dependency order: core → ui → cli.
# We invoke tsup (and tailwindcss for @lmthing/agent-ui) directly per package.
RUN cd packages/core && pnpm exec tsup
RUN cd packages/ui   && pnpm exec tsup && pnpm exec tailwindcss -i src/app/styles.css -o dist-web/app.css --minify
RUN cd packages/cli  && pnpm exec tsup

# Build the unified web app (studio/computer/chat as client-side routes). It
# resolves the shared libs under ./libs and the favicons under ./common via the
# @lmthing/utils vite config (findOrgRoot detects /build as the org root).
# `vp` is vite-plus.
COPY libs/    ./libs/
COPY common/  ./common/
COPY packages/ui/apps/ ./packages/ui/apps/
RUN cd packages/ui/apps/web && pnpm exec vp build

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
# Node 24 runs the tsup ESM bundle and resolves node-pty's native addon (.node)
# correctly, which the PTY terminals exposed over /api/ws require.
FROM node:24-slim

WORKDIR /app

# Install git so per-user spaces can be synced from GitHub at runtime
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy built artefacts and node_modules from the builder stage.
# node_modules contains quickjs-emscripten (with its bundled WASM), esbuild,
# and all other runtime dependencies — no install needed here.
COPY --from=builder /build/node_modules         ./node_modules
COPY --from=builder /build/packages/core/dist   ./packages/core/dist
COPY --from=builder /build/packages/core/node_modules ./packages/core/node_modules
# system-spaces must sit at packages/core/system-spaces/ relative to the
# working directory so the runtime path resolution (relative to built core) works.
COPY --from=builder /build/packages/core/system-spaces ./packages/core/system-spaces
COPY --from=builder /build/packages/cli/dist    ./packages/cli/dist
COPY --from=builder /build/packages/cli/node_modules  ./packages/cli/node_modules
# The cli bundle inlines @lmthing/core, so defaultSystemSpaceDirs() resolves the
# shipped system spaces RELATIVE TO THE BUNDLE (.../cli/dist/cli/bin.js →
# ../system-spaces = .../cli/dist/system-spaces), not relative to the core
# package. Place a copy there so `materializeRuntime` finds them; without it the
# runtime materializes an empty system/ dir and every session fails with
# `Agent "thing" not found`.
COPY --from=builder /build/packages/core/system-spaces ./packages/cli/dist/system-spaces
COPY --from=builder /build/packages/ui/dist        ./packages/ui/dist
# dist-web/app.css is the prebuilt Tailwind CSS served by the web DevTools UI
COPY --from=builder /build/packages/ui/dist-web    ./packages/ui/dist-web
# src is required at runtime: the `--web` dev path esbuild-bundles the web app
# from @lmthing/agent-ui/src/app/main.tsx (and the ink compat shims) on startup.
COPY --from=builder /build/packages/ui/src         ./packages/ui/src
COPY --from=builder /build/packages/ui/node_modules ./packages/ui/node_modules
# Prebuilt unified web app served by `lmthing serve` (studio/computer/chat are
# client-side routes under /studio, /computer, /chat). static-apps.ts resolves it
# via findAppsBase() → /app/packages/ui/apps/web/dist.
COPY --from=builder /build/packages/ui/apps/web/dist   ./packages/ui/apps/web/dist
# Copy package.json files so the module resolver can walk the workspace graph
COPY --from=builder /build/package.json         ./package.json
COPY --from=builder /build/packages/core/package.json ./packages/core/package.json
COPY --from=builder /build/packages/cli/package.json  ./packages/cli/package.json
COPY --from=builder /build/packages/ui/package.json   ./packages/ui/package.json

# Runtime root.
# The server runs with its cwd set to /data so `lmthingRoot` resolves to
# /data/.lmthing — the single source of truth for projects, spaces, and
# session snapshots, all persisted on the pod volume mounted at /data
# (emptyDir for now; paid tiers may use a PVC — see user-pod-template.yaml).
RUN mkdir -p /data

EXPOSE 8080

# Run the server from /data so .lmthing lands on the persistent volume.
# Built artefacts remain under /app, so the entrypoint is referenced by its
# absolute path.
WORKDIR /data

# Start the multi-session server. MAX_SESSIONS (default 8) controls how many
# concurrent QuickJS VMs are allowed in this pod — see user-pod-template.yaml
# for the corresponding env var and memory sizing notes.
CMD ["node", "/app/packages/cli/dist/cli/bin.js", "serve", "--port", "8080"]

# redeploy: lazy model resolution + lockfile sync
# retrigger: system-spaces co-location + LRU idle eviction (sdk/org 81c6d8e)
# retrigger: serve-path runtime init (sdk/org 730cf80)
# retrigger: fs routes + auth.ok + terminal command + log interceptor (sdk/org 324014c)
# retrigger: restart API + restart button + upgrade flow (sdk/org 0c979e6)
# retrigger: serve studio/computer/chat from the pod (libs relocated into sdk/org)
