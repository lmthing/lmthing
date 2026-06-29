# ── Stage 1: Build the Vite app ─────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /repo

# vite-plus (Rust) reads the system CA store; node:22-slim ships without it.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g corepack && corepack enable && corepack prepare pnpm@10.17.1 --activate

# Workspace manifests — all package.json files must be present for frozen-lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY blog/package.json           blog/
COPY casa/package.json           casa/
COPY chat/package.json           chat/
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
COPY sdk/org/packages/core/package.json sdk/org/packages/core/
COPY sdk/org/packages/cli/package.json  sdk/org/packages/cli/
COPY sdk/org/packages/ui/package.json   sdk/org/packages/ui/
COPY sdk/org/packages/ui/apps/studio/package.json   sdk/org/packages/ui/apps/studio/
COPY sdk/org/packages/ui/apps/computer/package.json sdk/org/packages/ui/apps/computer/
COPY sdk/org/packages/ui/apps/chat/package.json     sdk/org/packages/ui/apps/chat/

RUN pnpm install --frozen-lockfile

# Copy source for social and its workspace dependencies
COPY social/ social/
COPY sdk/org/ sdk/org/

RUN pnpm --filter @lmthing/social build

# ── Stage 2: Serve with nginx ────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /repo/social/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/social/dist/      /usr/share/nginx/html/
EXPOSE 80
