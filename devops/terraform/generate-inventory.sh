#!/usr/bin/env bash
# Generate Ansible/Kubespray inventory from Terraform outputs.
# Usage: ./generate-inventory.sh [inventory_file]
# Default output: ../ansible/inventory/test/hosts.yml
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="${1:-$SCRIPT_DIR/../ansible/inventory/test/hosts.yml}"

cd "$SCRIPT_DIR"

# Read Terraform outputs as JSON
NODES=$(terraform output -json nodes)
USERNAME=$(terraform output -raw admin_username)
KEY_PATH=$(terraform output -raw ssh_private_key_path)

# Build hosts section
HOSTS=""
CONTROL_PLANE=""
WORKERS=""
ETCD=""
etcd_index=1

for name in $(echo "$NODES" | jq -r 'keys[]' | sort); do
  public_ip=$(echo "$NODES" | jq -r ".\"$name\".public_ip")
  private_ip=$(echo "$NODES" | jq -r ".\"$name\".private_ip")
  role=$(echo "$NODES" | jq -r ".\"$name\".role")

  HOSTS+="    ${name}:
      ansible_host: ${public_ip}
      ansible_user: ${USERNAME}
      ansible_become: true
      ansible_ssh_private_key_file: \"${KEY_PATH}\"
      ip: ${private_ip}
      access_ip: ${private_ip}
"

  if [ "$role" = "control_plane" ]; then
    HOSTS+="      etcd_member_name: etcd${etcd_index}
"
    etcd_index=$((etcd_index + 1))
    CONTROL_PLANE+="        ${name}:\n"
    ETCD+="        ${name}:\n"
    # Control plane nodes also run workloads
    WORKERS+="        ${name}:\n"
  else
    WORKERS+="        ${name}:\n"
  fi
done

cat > "$OUTPUT" <<EOF
---
all:
  hosts:
${HOSTS}  children:
    kube_control_plane:
      hosts:
$(echo -e "$CONTROL_PLANE")    etcd:
      hosts:
$(echo -e "$ETCD")    kube_node:
      hosts:
$(echo -e "$WORKERS")    calico_rr:
      hosts: {}
    bastion:
      hosts: {}
    _kubespray_needs_etcd:
      hosts: {}
    k8s_cluster:
      children:
        kube_control_plane:
        kube_node:
EOF

NODE_COUNT=$(echo "$NODES" | jq 'length')
CP_COUNT=$(echo "$NODES" | jq '[.[] | select(.role == "control_plane")] | length')
WORKER_COUNT=$(echo "$NODES" | jq '[.[] | select(.role == "worker")] | length')

echo "Inventory written to: $OUTPUT"
echo "Nodes: ${NODE_COUNT} total (${CP_COUNT} control plane, ${WORKER_COUNT} worker)"
echo ""
echo "Next steps:"
echo "  cd ../ansible && make ping    # verify connectivity"
if [ "$WORKER_COUNT" -gt 0 ] && [ -f "$OUTPUT" ]; then
  echo "  cd ../ansible && make scale   # add new nodes to existing cluster"
fi
