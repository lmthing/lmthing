#!/bin/bash
set -euo pipefail

echo "=== LMThing Gateway — VM Setup ==="
echo "Target: Ubuntu 24.04, K3s + Docker"
echo ""

# Install system deps
echo "→ Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y docker.io postgresql-client gettext-base

# Enable Docker
if ! systemctl is-active --quiet docker; then
  sudo systemctl enable docker
  sudo systemctl start docker
fi
sudo usermod -aG docker "$USER" 2>/dev/null || true
echo "  docker, psql, envsubst installed"

# Install K3s
if ! command -v k3s &>/dev/null; then
  echo "→ Installing K3s..."
  curl -sfL https://get.k3s.io | sh -
  echo "  Waiting for K3s node to be ready..."
  sleep 10
  sudo k3s kubectl wait --for=condition=Ready node --all --timeout=120s
  echo "  K3s installed and ready"
else
  echo "→ K3s already installed"
fi

# Allow current user to use kubectl without sudo
mkdir -p "$HOME/.kube"
sudo cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
sudo chown "$USER:$USER" "$HOME/.kube/config"
echo "→ kubeconfig ready at ~/.kube/config"

# Open firewall ports (if ufw is active)
if command -v ufw &>/dev/null && sudo ufw status | grep -q "active"; then
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 6443/tcp
  echo "→ Firewall ports 80, 443, 6443 opened"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Verify: kubectl get nodes"
echo ""
echo "Next: fill in k8s/.env.secrets, then run scripts/deploy.sh"
