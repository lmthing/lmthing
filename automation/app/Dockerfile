# ── Stage 1: Build the scenario dashboard (@lmthing/scenario-dash) ──────────
# Hono backend (tsc) + Vite/React SPA. Built from the repo-root context so the
# pnpm workspace + sdk/org/libs/css (the design-token theme) resolve.
FROM node:24-slim AS builder
WORKDIR /repo

# vite-plus (Rust) reads the system CA store; node:24-slim ships without it.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g corepack && corepack enable && corepack prepare pnpm@10.17.1 --activate

# Workspace manifests — all package.json files must be present for frozen-lockfile.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY blog/package.json           blog/
COPY casa/package.json           casa/
COPY cloud/package.json          cloud/
COPY com/package.json            com/
COPY org/package.json            org/
COPY social/package.json         social/
COPY space/package.json          space/
COPY store/package.json          store/
COPY team/package.json           team/
COPY sdk/org/libs/auth/package.json         sdk/org/libs/auth/
COPY sdk/org/libs/config/package.json       sdk/org/libs/config/
COPY sdk/org/libs/css/package.json          sdk/org/libs/css/
COPY sdk/org/libs/state/package.json        sdk/org/libs/state/
COPY sdk/org/libs/ui/package.json           sdk/org/libs/ui/
COPY sdk/org/libs/utils/package.json        sdk/org/libs/utils/
COPY sdk/org/libs/core/package.json sdk/org/libs/core/
COPY sdk/org/libs/cli/package.json  sdk/org/libs/cli/
COPY sdk/org/apps/web/package.json sdk/org/apps/web/
COPY automation/app/package.json   automation/app/

RUN pnpm install --frozen-lockfile

# Source the build needs: the css lib (theme alias) + the app itself.
COPY sdk/org/libs/css/ sdk/org/libs/css/
COPY automation/app/   automation/app/

RUN pnpm --filter @lmthing/scenario-dash build

# ── Stage 2: Runtime (single node process serves SPA + API) ──────────────────
# The server is an esbuild bundle (all deps inlined) so NO node_modules are needed
# at runtime — this avoids pnpm's .pnpm symlink problem when copying a subset.
FROM node:24-slim
WORKDIR /app
COPY --from=builder /repo/automation/app/dist     ./dist
COPY --from=builder /repo/automation/app/ui-dist  ./ui-dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server-bundle.mjs"]
