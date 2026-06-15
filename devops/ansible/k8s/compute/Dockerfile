# LEGACY FILE — this Dockerfile is no longer the active build source.
#
# The canonical compute image Dockerfile is:
#   devops/argocd/compute/Dockerfile
#
# Images are built by GitHub Actions CI (not Ansible) and pushed to ACR.
# CI build context: sdk/org submodule root.
# See devops/CLAUDE.md § "cloud_build_images" for details.
#
# This file is kept for historical reference only. Do not edit.
# If you need to make changes, edit devops/argocd/compute/Dockerfile.

FROM oven/bun:latest

WORKDIR /app

# Install git for workspace sync
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# DEPRECATED: previously copied sdk/org/repl (the old single-session REPL server).
# The new framework lives in sdk/org/packages/{core,cli} and runs as a
# multi-session server. See devops/argocd/compute/Dockerfile.
COPY sdk/org/repl/package.json ./package.json
RUN bun install --production

COPY sdk/org/repl/src ./src

RUN mkdir -p /data/spaces

EXPOSE 8080

CMD ["bun", "run", "src/cli/bin.ts", "--port", "8080"]
