#!/usr/bin/env bash
# Launch the web UI with THING's ported content, natively via `dsh --profile lmthing-web` — no
# --patch-on-stock-web workaround needed any more (Part A3, see dsh/PROGRESS.md: the profile's
# package.json must list ONLY @lmthing/* link deps under "dependencies", matching the stock `web`
# profile's own shape — the root cause was a duplicate module identity from also pinning
# @deepseek-ai/dsh-web-app as a direct dependency, which `dsh plugin --profile <name> add
# @deepseek-ai/dsh-web-app` adds automatically when bootstrapping a fresh profile this way; remove
# it from dependencies after bootstrapping, keeping it only in dsh.profile.bundles).
#
# Usage:
#   ./scripts/run-web.sh                    # keyless (lmthing-mock, trigger phrases only)
#   LMTHING_CLOUD_API_KEY=sk-... ./scripts/run-web.sh --real   # real model, free-form chat
set -euo pipefail
cd "$(dirname "$0")/.."
DSH_DIR="$(pwd)"

node scripts/assemble-lmthing-profile.mjs lmthing-web >/dev/null

PATCHES=()
if [[ "${1:-}" == "--real" ]]; then
  if [[ -z "${LMTHING_CLOUD_API_KEY:-}" ]]; then
    echo "error: --real requires LMTHING_CLOUD_API_KEY to be set" >&2
    exit 1
  fi
  PATCHES+=(--patch "$DSH_DIR/.local/real-provider.patch.yml")
fi

echo "Starting — open http://127.0.0.1:3081 in your browser once it's up."
DSH_HOME="$DSH_DIR/.dsh-home" npx --prefix "$DSH_DIR" dsh --profile lmthing-web "${PATCHES[@]}" --port 3081 --no-open
