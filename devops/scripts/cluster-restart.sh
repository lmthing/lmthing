#!/usr/bin/env bash
# Roll-restart deployments on the production cluster.
#
#   ./devops/scripts/cluster-restart.sh gateway          # one deploy in lmthing
#   NS=user-abc123 ./devops/scripts/cluster-restart.sh lmthing
#   ./devops/scripts/cluster-restart.sh --all-user-pods  # every per-user compute pod
#
# --all-user-pods is the blunt fallback. Normally users are prompted in-app to
# upgrade individually (PodEnsureGate in sdk/org/apps/web) — prefer that.
set -euo pipefail
here="$(dirname "${BASH_SOURCE[0]}")"
kubectl_sh="$here/cluster-kubectl.sh"

if [ $# -eq 0 ]; then
  echo "usage: cluster-restart.sh <deployment> | --all-user-pods" >&2
  exit 64
fi

if [ "$1" = "--all-user-pods" ]; then
  echo "Restarting lmthing deployment in EVERY user-* namespace..." >&2
  read -r -p "This bounces every user's compute pod. Continue? [y/N] " ok
  [ "$ok" = "y" ] || { echo "aborted"; exit 1; }
  # Loop on the node — one SSH round-trip instead of one per namespace.
  exec "$here/cluster-ssh.sh" \
    'kubectl get ns -o name | grep -oP "(?<=namespace/)user-.*" |
       xargs -r -I{} kubectl rollout restart deployment/lmthing -n {}'
fi

ns="${NS:-lmthing}"
"$kubectl_sh" rollout restart "deployment/$1" -n "$ns"
exec "$kubectl_sh" rollout status "deployment/$1" -n "$ns" --timeout=180s
