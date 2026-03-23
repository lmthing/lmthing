#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLOUD_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$CLOUD_DIR")"

# ── Parse arguments ──────────────────────────────────────────
VM_HOST=""
SSH_KEY=""
VM_USER="azureuser"

usage() {
  echo "Usage: deploy.sh --host <vm-ip> --key <ssh-key-path> [--user <ssh-user>]"
  echo ""
  echo "Deploy lmthing cloud services to a K3s VM."
  echo "Syncs files, builds images, applies K8s manifests, and waits for rollouts."
  echo ""
  echo "Options:"
  echo "  --host   VM IP address or hostname (required)"
  echo "  --key    Path to SSH private key (required)"
  echo "  --user   SSH username (default: azureuser)"
  echo "  --help   Show this help message"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --host) VM_HOST="$2"; shift 2 ;;
    --key)  SSH_KEY="$2"; shift 2 ;;
    --user) VM_USER="$2"; shift 2 ;;
    --help) usage ;;
    *)      echo "Unknown option: $1"; echo ""; usage ;;
  esac
done

if [[ -z "$VM_HOST" || -z "$SSH_KEY" ]]; then
  echo "ERROR: --host and --key are required"
  echo ""
  usage
fi

SSH_KEY="$(realpath "$SSH_KEY")"
if [[ ! -f "$SSH_KEY" ]]; then
  echo "ERROR: SSH key not found: $SSH_KEY"
  exit 1
fi

# Check local prerequisites
if [[ ! -f "$CLOUD_DIR/k8s/.env.secrets" ]]; then
  echo "ERROR: k8s/.env.secrets not found"
  echo "Copy k8s/.env.secrets.example to k8s/.env.secrets and fill in values"
  exit 1
fi

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new"
REMOTE="$VM_USER@$VM_HOST"

echo "=== LMThing — Deploy ==="
echo "  VM: $REMOTE"
echo ""

# ── 1. Sync files to VM ─────────────────────────────────────
echo "→ Syncing cloud/ to VM..."
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.yaml.tpl' \
  -e "ssh $SSH_OPTS" \
  "$CLOUD_DIR/" "$REMOTE:~/cloud/"

# Sync templates separately (rsync --exclude above skips them)
rsync -az \
  -e "ssh $SSH_OPTS" \
  "$CLOUD_DIR/k8s/"*.yaml.tpl "$REMOTE:~/cloud/k8s/"

# Sync computer app if dist exists
if [[ -d "$REPO_DIR/computer/dist" && -f "$REPO_DIR/computer/Dockerfile" ]]; then
  echo "→ Syncing computer/ to VM..."
  rsync -az --delete \
    -e "ssh $SSH_OPTS" \
    "$REPO_DIR/computer/dist/" "$REMOTE:~/computer/dist/"
  # Sync Dockerfile and nginx.conf
  for f in Dockerfile nginx.conf; do
    if [[ -f "$REPO_DIR/computer/$f" ]]; then
      scp $SSH_OPTS "$REPO_DIR/computer/$f" "$REMOTE:~/computer/$f"
    fi
  done
fi

# ── 2. Run deployment on VM ──────────────────────────────────
echo "→ Running deployment on VM..."
ssh $SSH_OPTS "$REMOTE" 'bash -s' <<'DEPLOY'
set -euo pipefail

CLOUD_DIR=~/cloud
K8S_DIR=$CLOUD_DIR/k8s

if [ ! -f "$K8S_DIR/.env.secrets" ]; then
  echo "ERROR: k8s/.env.secrets not found on VM"
  exit 1
fi

# Source env vars for template rendering
set -a
source "$K8S_DIR/.env.secrets"
set +a

# ── Database migrations ──────────────────────────────────────
echo "→ Running database migrations..."
for migration in "$CLOUD_DIR"/migrations/*.sql; do
  [ -f "$migration" ] || continue
  echo "  Applying $(basename "$migration")..."
  if ! LC_ALL=C psql -q "$DATABASE_URL" -f "$migration" 2>&1 | grep -v "^NOTICE:"; then
    echo "ERROR: Migration $(basename "$migration") failed."
    exit 1
  fi
done

# ── Render K8s templates ─────────────────────────────────────
echo "→ Rendering templates..."
envsubst '${DOMAIN}' < "$K8S_DIR/ingress.yaml.tpl" > "$K8S_DIR/ingress.yaml"
envsubst '${ACME_EMAIL}' < "$K8S_DIR/traefik-config.yaml.tpl" > "$K8S_DIR/traefik-config.yaml"

# ── Traefik TLS config ──────────────────────────────────────
echo "→ Applying Traefik config (Let's Encrypt)..."
sudo k3s kubectl apply -f "$K8S_DIR/traefik-config.yaml"

echo "  Waiting for Traefik Helm reconciliation..."
sleep 10
sudo k3s kubectl -n kube-system rollout status deployment/traefik --timeout=60s 2>/dev/null || true

# ── Build gateway Docker image ───────────────────────────────
echo "→ Building gateway image..."
cd "$CLOUD_DIR/gateway"
sudo docker build -t lmthing/gateway:latest .

echo "→ Importing gateway image into K3s..."
sudo docker save lmthing/gateway:latest | sudo k3s ctr images import -

# ── Build computer Docker image ──────────────────────────────
if [ -d ~/computer ] && [ -f ~/computer/Dockerfile ]; then
  echo "→ Building computer image..."
  cd ~/computer
  sudo docker build -t lmthing/computer:latest .

  echo "→ Importing computer image into K3s..."
  sudo docker save lmthing/computer:latest | sudo k3s ctr images import -
fi

# ── Apply K8s manifests ──────────────────────────────────────
echo "→ Applying K8s manifests..."
cd "$K8S_DIR"

# Create namespace if needed
sudo k3s kubectl create namespace lmthing 2>/dev/null || true

# Apply all manifests (Kustomize secretGenerator handles secrets from .env.secrets)
# Force to ensure secret content is updated even if unchanged metadata
sudo k3s kubectl apply -k . --force

# ── Wait for rollouts ───────────────────────────────────────
# LiteLLM takes 2-3 min on first run (Prisma migrations)
echo "→ Waiting for LiteLLM (first run takes ~3 min for migrations)..."
sudo k3s kubectl -n lmthing rollout status deployment/litellm --timeout=300s

echo "→ Waiting for Gateway..."
sudo k3s kubectl -n lmthing rollout status deployment/gateway --timeout=120s

echo "→ Waiting for Computer..."
sudo k3s kubectl -n lmthing rollout status deployment/computer --timeout=60s 2>/dev/null || true

# ── Verify ───────────────────────────────────────────────────
echo ""
echo "=== Deploy complete ==="
echo ""
sudo k3s kubectl -n lmthing get pods
echo ""
echo "Endpoints:"
echo "  API:      https://${DOMAIN}/v1/chat/completions"
echo "  Gateway:  https://${DOMAIN}/api/health"
echo "  Webhook:  https://${DOMAIN}/api/stripe/webhook"
echo "  Computer: https://lmthing.computer"
DEPLOY
