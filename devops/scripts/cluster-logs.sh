#!/usr/bin/env bash
# Tail logs for a deployment on the production cluster.
#
#   ./devops/scripts/cluster-logs.sh gateway            # follow, namespace lmthing
#   ./devops/scripts/cluster-logs.sh org --tail=200     # extra kubectl logs flags
#   NS=user-abc123 ./devops/scripts/cluster-logs.sh lmthing
set -euo pipefail
here="$(dirname "${BASH_SOURCE[0]}")"

if [ $# -eq 0 ]; then
  echo "usage: cluster-logs.sh <deployment> [kubectl logs flags...]" >&2
  echo "  e.g. cluster-logs.sh gateway --tail=200" >&2
  exit 64
fi

deploy="$1"; shift
ns="${NS:-lmthing}"

# Default to -f, but let the caller override by passing their own flags.
if [ $# -eq 0 ]; then set -- -f; fi

exec "$here/cluster-kubectl.sh" logs -n "$ns" "deployment/$deploy" "$@"
