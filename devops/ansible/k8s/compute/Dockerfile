FROM oven/bun:latest

WORKDIR /app

# Install git for workspace sync
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy repl package and install dependencies
COPY sdk/org/repl/package.json ./package.json
RUN bun install --production

# Copy repl source
COPY sdk/org/repl/src ./src

# User spaces are mounted or synced at runtime via /data/spaces
RUN mkdir -p /data/spaces

EXPOSE 8080

# Start the REPL WebSocket server
CMD ["bun", "run", "src/cli/bin.ts", "--port", "8080"]
