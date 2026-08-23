#!/usr/bin/env bash
# Launch the web UI with THING's ported content. See dsh/packages/README.md
# ("The lmthing-web profile is broken; use --patch on the stock web profile
# instead") for why this doesn't use `dsh --profile lmthing-web`.
#
# Usage:
#   ./scripts/run-web.sh                    # keyless (lmthing-mock, trigger phrases only)
#   LMTHING_CLOUD_API_KEY=sk-... ./scripts/run-web.sh --real   # real model, free-form chat
set -euo pipefail
cd "$(dirname "$0")/.."
DSH_DIR="$(pwd)"

node scripts/assemble-lmthing-profile.mjs lmthing-web >/dev/null

PATCHES=(--patch "$DSH_DIR/.dsh-home/profiles/lmthing-web/cordis.patch.yml")
if [[ "${1:-}" == "--real" ]]; then
  if [[ -z "${LMTHING_CLOUD_API_KEY:-}" ]]; then
    echo "error: --real requires LMTHING_CLOUD_API_KEY to be set" >&2
    exit 1
  fi
  PATCHES+=(--patch "$DSH_DIR/.local/real-provider.patch.yml")
fi

echo "Starting — open http://127.0.0.1:3081 in your browser once it's up."
DSH_HOME="$DSH_DIR/.dsh-home" npx --prefix "$DSH_DIR" dsh --profile web "${PATCHES[@]}" --port 3081 --no-open
