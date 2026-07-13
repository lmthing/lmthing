#!/usr/bin/env bash
# Shared connection settings for the production cluster. Sourced by the other
# cluster-*.sh scripts; not meant to be run directly.
#
# Override anything via the environment:
#   LMTHING_SSH_HOST   default azureuser@4.223.83.5
#   LMTHING_SSH_KEY    path to the private key (skips the search below)
set -euo pipefail

LMTHING_SSH_HOST="${LMTHING_SSH_HOST:-azureuser@4.223.83.5}"

# The key is terraform output, so it is gitignored and NOT present in a fresh
# clone. Search the usual places rather than hard-coding one path.
_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
_key_candidates=(
  "${LMTHING_SSH_KEY:-}"
  "$_repo_root/devops/terraform/generated/lmthing-test-key.pem"
  "$HOME/GEANT/lmthing/devops/terraform/generated/lmthing-test-key.pem"
  "$HOME/.ssh/lmthing-test-key.pem"
)

LMTHING_SSH_KEY=""
for _c in "${_key_candidates[@]}"; do
  [ -n "$_c" ] && [ -f "$_c" ] && { LMTHING_SSH_KEY="$_c"; break; }
done

if [ -z "$LMTHING_SSH_KEY" ]; then
  echo "cluster: no SSH key found. Looked in:" >&2
  for _c in "${_key_candidates[@]}"; do [ -n "$_c" ] && echo "  $_c" >&2; done
  echo "Set LMTHING_SSH_KEY=/path/to/key.pem, or run 'terraform apply' in devops/terraform" >&2
  echo "to regenerate it (the key is terraform output — it is not committed)." >&2
  exit 1
fi

# ssh refuses a group/world-readable key; a fresh terraform output can be 0644.
if [ "$(stat -c '%a' "$LMTHING_SSH_KEY")" != "600" ]; then
  chmod 600 "$LMTHING_SSH_KEY"
fi

# Always invoke as an array — a quoted "$SSH" string does NOT word-split under
# zsh, which silently turns the whole command into one bogus filename.
SSH_CMD=(ssh -i "$LMTHING_SSH_KEY" -o StrictHostKeyChecking=no
         -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR
         -o ConnectTimeout=20 "$LMTHING_SSH_HOST")

export LMTHING_SSH_HOST LMTHING_SSH_KEY
