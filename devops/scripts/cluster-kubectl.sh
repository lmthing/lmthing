#!/usr/bin/env bash
# Run kubectl on the production cluster. Every argument is passed through.
#
#   ./devops/scripts/cluster-kubectl.sh get pods -n lmthing
#   ./devops/scripts/cluster-kubectl.sh get deploy --all-namespaces -o wide
#   ./devops/scripts/cluster-kubectl.sh -n lmthing describe pod org-xxxx
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/cluster-env.sh"

if [ $# -eq 0 ]; then
  echo "usage: cluster-kubectl.sh <kubectl args...>" >&2
  exit 64
fi

# printf %q quotes each arg so jsonpath braces, globs and spaces survive the
# trip through the remote shell.
remote="kubectl"
for a in "$@"; do remote+=" $(printf '%q' "$a")"; done

exec "${SSH_CMD[@]}" -- "$remote"
