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
COPY org/libs/auth/package.json  org/libs/auth/
COPY org/libs/core/package.json  org/libs/core/
COPY org/libs/css/package.json   org/libs/css/
COPY org/libs/repl/package.json  org/libs/repl/
COPY org/libs/state/package.json org/libs/state/
COPY org/libs/thing/package.json org/libs/thing/
COPY org/libs/ui/package.json    org/libs/ui/
COPY org/libs/utils/package.json org/libs/utils/

RUN pnpm install --frozen-lockfile

# Copy source for studio and its workspace dependencies
COPY studio/ studio/
COPY org/libs/ org/libs/
COPY org/common/ org/common/

RUN pnpm --filter @lmthing/app build

# ── Stage 2: Serve with nginx ────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /repo/studio/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/studio/dist/      /usr/share/nginx/html/
EXPOSE 80
