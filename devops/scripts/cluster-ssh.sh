#!/usr/bin/env bash
# SSH to the production cluster node.
#
#   ./devops/scripts/cluster-ssh.sh                 # interactive shell
#   ./devops/scripts/cluster-ssh.sh uptime          # run a command
#   ./devops/scripts/cluster-ssh.sh 'kubectl get ns'
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/cluster-env.sh"

if [ $# -eq 0 ]; then
  exec "${SSH_CMD[@]}"
fi
exec "${SSH_CMD[@]}" -- "$*"
