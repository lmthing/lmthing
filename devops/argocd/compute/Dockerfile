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
# `lmthing serve`. Its built dist lands at /app/apps/web/dist.
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
COPY libs/core/package.json   ./libs/core/package.json
COPY libs/cli/package.json    ./libs/cli/package.json
COPY libs/ui/package.json     ./libs/ui/package.json
COPY libs/auth/package.json   ./libs/auth/package.json
COPY libs/css/package.json    ./libs/css/package.json
COPY libs/config/package.json ./libs/config/package.json
COPY libs/state/package.json  ./libs/state/package.json
COPY libs/utils/package.json  ./libs/utils/package.json
COPY apps/web/package.json    ./apps/web/package.json

# Install all workspace dependencies (dev deps needed for tsup + vite builds).
# The checked-in pnpm-lock.yaml is the source of truth; --frozen-lockfile
# guarantees reproducible installs.
RUN pnpm install --frozen-lockfile

# @lmthing/config provides shared tsconfig presets (node-lib, react-lib, base)
# referenced by extends in libs/core/tsconfig.json and libs/cli/tsconfig.json.
# The full directory must be present so pnpm's workspace symlink resolves correctly.
COPY libs/config/ ./libs/config/

# Copy source for the runtime packages we need to build
COPY libs/core/src          ./libs/core/src
COPY libs/core/tsup.config.ts ./libs/core/tsup.config.ts
COPY libs/core/tsconfig.json  ./libs/core/tsconfig.json
# system-spaces are read at runtime relative to the built core dist directory;
# copy them alongside the source so they land in the correct position after build.
COPY libs/core/system-spaces ./libs/core/system-spaces

COPY libs/cli/src           ./libs/cli/src
COPY libs/cli/tsup.config.ts ./libs/cli/tsup.config.ts
COPY libs/cli/tsconfig.json  ./libs/cli/tsconfig.json

# @lmthing/ui (libs/ui) is a source-only package — no tsup step needed.
# It is consumed directly from src by the CLI's esbuild bundler (--web mode)
# and as a Vite workspace dep for the apps/web build.

# Build the runtime packages in dependency order: core → cli.
RUN cd libs/core && pnpm exec tsup
RUN cd libs/cli  && pnpm exec tsup

# Build the unified web app (studio/computer/chat as client-side routes). It
# resolves the shared libs under ./libs and the favicons under ./common via the
# @lmthing/utils vite config (findOrgRoot detects /build as the org root).
# `vp` is vite-plus.
COPY libs/    ./libs/
COPY common/  ./common/
COPY apps/    ./apps/
RUN cd apps/web && pnpm exec vp build

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
# Node 24 runs the tsup ESM bundle and resolves node-pty's native addon (.node)
# correctly, which the PTY terminals exposed over /api/ws require.
FROM node:24-slim

WORKDIR /app

# git — per-user spaces synced from GitHub at runtime; ca-certificates — Node's
# global fetch (app installs, GitHub) needs the system CA store for HTTPS.
RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*

# Where POST /api/apps/install downloads catalog apps from. In-cluster the pod reaches
# the store via its ClusterIP Service over HTTP — no LB hairpin, no TLS/CA needed. (Local
# `lmthing serve` runs from source without this env and falls back to https://lmthing.store.)
ENV LM_STORE_URL=http://store.lmthing.svc.cluster.local

# Copy built artefacts and node_modules from the builder stage.
# node_modules contains quickjs-emscripten (with its bundled WASM), esbuild,
# and all other runtime dependencies — no install needed here.
COPY --from=builder /build/node_modules         ./node_modules
COPY --from=builder /build/libs/core/dist       ./libs/core/dist
COPY --from=builder /build/libs/core/node_modules ./libs/core/node_modules
# system-spaces must sit at libs/core/system-spaces/ relative to the
# working directory so the runtime path resolution (relative to built core) works.
COPY --from=builder /build/libs/core/system-spaces ./libs/core/system-spaces
COPY --from=builder /build/libs/cli/dist        ./libs/cli/dist
COPY --from=builder /build/libs/cli/node_modules  ./libs/cli/node_modules
# The cli bundle inlines @lmthing/core, so defaultSystemSpaceDirs() resolves the
# shipped system spaces RELATIVE TO THE BUNDLE (.../cli/dist/cli/bin.js →
# ../system-spaces = .../cli/dist/system-spaces), not relative to the core
# package. Place a copy there so `materializeRuntime` finds them; without it the
# runtime materializes an empty system/ dir and every session fails with
# `Agent "thing" not found`.
COPY --from=builder /build/libs/core/system-spaces ./libs/cli/dist/system-spaces
# @lmthing/ui source is required at runtime: the `--web` dev path esbuild-bundles
# the web app from @lmthing/ui/src/chat/app/main.tsx on startup.
COPY --from=builder /build/libs/ui/src          ./libs/ui/src
COPY --from=builder /build/libs/ui/node_modules  ./libs/ui/node_modules
# Prebuilt unified web app served by `lmthing serve` (studio/computer/chat are
# client-side routes under /studio, /computer, /chat). static-apps.ts resolves it
# via findAppsBase() → /app/apps/web/dist.
COPY --from=builder /build/apps/web/dist        ./apps/web/dist
# Copy package.json files so the module resolver can walk the workspace graph
COPY --from=builder /build/package.json         ./package.json
COPY --from=builder /build/libs/core/package.json ./libs/core/package.json
COPY --from=builder /build/libs/cli/package.json  ./libs/cli/package.json
COPY --from=builder /build/libs/ui/package.json   ./libs/ui/package.json

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
CMD ["node", "/app/libs/cli/dist/cli/bin.js", "serve", "--port", "8080"]
