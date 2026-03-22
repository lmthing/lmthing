#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLOUD_DIR="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$CLOUD_DIR/k8s"

echo "=== LMThing Gateway — Deploy ==="

# Check prerequisites
if [ ! -f "$K8S_DIR/.env.secrets" ]; then
  echo "ERROR: k8s/.env.secrets not found"
  echo "Copy k8s/.env.secrets.example to k8s/.env.secrets and fill in values"
  exit 1
fi

# Source env vars for template rendering
set -a
source "$K8S_DIR/.env.secrets"
set +a

# ── 1. Database migrations ──────────────────────────────────────
echo "→ Running database migrations..."
for migration in "$CLOUD_DIR"/migrations/*.sql; do
  echo "  Applying $(basename "$migration")..."
  if ! psql "$DATABASE_URL" -f "$migration" 2>&1 | grep -v "^NOTICE:"; then
    echo "ERROR: Migration $(basename "$migration") failed."
    exit 1
  fi
done

# ── 2. Render K8s templates ─────────────────────────────────────
echo "→ Rendering templates..."
envsubst '${DOMAIN}' < "$K8S_DIR/ingress.yaml.tpl" > "$K8S_DIR/ingress.yaml"
envsubst '${ACME_EMAIL}' < "$K8S_DIR/traefik-config.yaml.tpl" > "$K8S_DIR/traefik-config.yaml"

# ── 3. Traefik TLS config ──────────────────────────────────────
echo "→ Applying Traefik config (Let's Encrypt)..."
sudo k3s kubectl apply -f "$K8S_DIR/traefik-config.yaml"

# Wait for Helm controller to reconcile (creates new Traefik pod with cert resolver args)
echo "  Waiting for Traefik Helm reconciliation..."
sleep 10
sudo k3s kubectl -n kube-system rollout status deployment/traefik --timeout=60s 2>/dev/null || true

# ── 4. Build gateway Docker image ──────────────────────────────
echo "→ Building gateway image..."
cd "$CLOUD_DIR/gateway"
sudo docker build -t lmthing/gateway:latest .

echo "→ Importing gateway image into K3s..."
sudo docker save lmthing/gateway:latest | sudo k3s ctr images import -

# ── 5. Apply K8s manifests ─────────────────────────────────────
echo "→ Applying K8s manifests..."
cd "$K8S_DIR"

# Create namespace if needed
sudo k3s kubectl create namespace lmthing 2>/dev/null || true

# Apply all manifests (Kustomize secretGenerator handles secrets from .env.secrets)
# Force to ensure secret content is updated even if unchanged metadata
sudo k3s kubectl apply -k . --force

# ── 6. Wait for rollouts ───────────────────────────────────────
# LiteLLM takes 2-3 min on first run (Prisma migrations)
echo "→ Waiting for LiteLLM (first run takes ~3 min for migrations)..."
sudo k3s kubectl -n lmthing rollout status deployment/litellm --timeout=300s

echo "→ Waiting for Gateway..."
sudo k3s kubectl -n lmthing rollout status deployment/gateway --timeout=120s

# ── 7. Verify ──────────────────────────────────────────────────
echo ""
echo "=== Deploy complete ==="
echo ""
sudo k3s kubectl -n lmthing get pods
echo ""
echo "Endpoints:"
echo "  API:     https://${DOMAIN}/v1/chat/completions"
echo "  Gateway: https://${DOMAIN}/api/health"
echo "  Webhook: https://${DOMAIN}/api/stripe/webhook"
echo ""
echo "LiteLLM UI (local): ssh -L 4000:localhost:4000 ${VM_USER:-azureuser}@${VM_HOST} \\"
echo "  'sudo k3s kubectl -n lmthing port-forward deployment/litellm 4000:4000'"
echo "  Then open http://localhost:4000/ui"
