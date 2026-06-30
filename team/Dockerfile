# ── Stage 1: Build the Vite app ─────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /repo

# vite-plus (Rust) reads the system CA store; node:24-slim ships without it.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g corepack && corepack enable && corepack prepare pnpm@10.17.1 --activate

# Workspace manifests — all package.json files must be present for frozen-lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY blog/package.json           blog/
COPY casa/package.json           casa/
COPY cloud/package.json          cloud/
COPY com/package.json            com/
COPY social/package.json         social/
COPY space/package.json          space/
COPY store/package.json          store/
COPY team/package.json           team/
COPY sdk/org/libs/auth/package.json         sdk/org/libs/auth/
COPY sdk/org/libs/css/package.json          sdk/org/libs/css/
COPY sdk/org/libs/state/package.json        sdk/org/libs/state/
COPY sdk/org/libs/ui/package.json           sdk/org/libs/ui/
COPY sdk/org/libs/utils/package.json        sdk/org/libs/utils/
COPY sdk/org/libs/config/package.json sdk/org/libs/config/
COPY sdk/org/libs/core/package.json   sdk/org/libs/core/
COPY sdk/org/libs/cli/package.json    sdk/org/libs/cli/
COPY sdk/org/apps/web/package.json    sdk/org/apps/web/

RUN pnpm install --frozen-lockfile

# Copy source for team and its workspace dependencies
COPY team/ team/
COPY sdk/org/ sdk/org/

RUN pnpm --filter @lmthing/team build

# ── Stage 2: Serve with nginx ────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /repo/team/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/team/dist/      /usr/share/nginx/html/
EXPOSE 80
