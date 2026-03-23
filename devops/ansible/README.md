# Ansible

This directory wraps Kubespray in a repo-local Ansible layout so `lmthing` can keep its own inventory, overrides, and post-install hooks without forking Kubespray itself.

## Design

- `inventory/test/hosts.yml` is a static inventory for a test cluster.
- `inventory/test/group_vars/all.yml` holds cluster-wide Kubespray overrides.
- `playbooks/kubespray.yml` imports the pinned Kubespray `cluster.yml` and then runs local post-install checks.
- `roles/k8s_postinstall/` makes sure the remote SSH user can use `kubectl` directly on the node.
- `scripts/setup/bootstrap.sh` clones Kubespray into `.cache/kubespray` and installs the Python/Ansible toolchain into `.venv`.

The bootstrap script pins Kubespray to `v2.30.0`, which was the latest upstream release on January 29, 2026.

## Usage

```bash
cd devops/ansible
make bootstrap
make inventory
make ping
make cluster
```

If your SSH key is not defined in `hosts.yml`, pass it at runtime:

```bash
make cluster EXTRA_ARGS="--private-key ~/.ssh/id_ed25519"
```

After the cluster is up, use `kubectl` on the remote node:

```bash
ssh -i "$HOME/.ssh/lmthing-vm_key.pem" azureuser@135.225.105.98
kubectl get nodes -o wide
kubectl get ns
```
