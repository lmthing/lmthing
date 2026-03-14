FROM node:20-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    procps \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

RUN pnpm prune --prod

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
