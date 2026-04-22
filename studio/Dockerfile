# ── Stage 1: Build the Vite app ─────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /repo

RUN npm install -g corepack && corepack enable && corepack prepare pnpm@10.17.1 --activate

# Workspace manifests — all package.json files must be present for frozen-lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY blog/package.json           blog/
COPY casa/package.json           casa/
COPY chat/package.json           chat/
COPY cloud/package.json          cloud/
COPY com/package.json            com/
COPY computer/package.json       computer/
COPY social/package.json         social/
COPY space/package.json          space/
COPY store/package.json          store/
COPY studio/package.json         studio/
COPY team/package.json           team/
COPY sdk/libs/auth/package.json  sdk/libs/auth/
COPY sdk/org/cli/package.json    sdk/org/cli/
COPY sdk/libs/css/package.json   sdk/libs/css/
COPY sdk/org/repl/package.json   sdk/org/repl/
COPY sdk/org/ui/package.json      sdk/org/ui/
COPY sdk/libs/state/package.json sdk/libs/state/
COPY sdk/libs/thing/package.json sdk/libs/thing/
COPY sdk/libs/ui/package.json    sdk/libs/ui/
COPY sdk/libs/utils/package.json sdk/libs/utils/

RUN pnpm install --frozen-lockfile

# Copy source for studio and its workspace dependencies
COPY studio/ studio/
COPY sdk/libs/ sdk/libs/
COPY sdk/org/ sdk/org/
COPY sdk/common/ sdk/common/

RUN pnpm --filter @lmthing/app build

# ── Stage 2: Serve with nginx ────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /repo/studio/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/studio/dist/      /usr/share/nginx/html/
EXPOSE 80
