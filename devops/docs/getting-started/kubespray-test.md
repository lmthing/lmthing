# Kubespray Test Cluster

This guide uses the static inventory in `devops/ansible/inventory/test/hosts.yml` to stand up a first Kubernetes cluster with Kubespray.

The bootstrap script currently pins Kubespray to `v2.30.0`, which was the latest upstream release on January 29, 2026.

## 1. Prepare nodes

- Provision at least 3 control-plane nodes and 2 worker nodes if you want HA etcd plus dedicated workers.
- Make sure the Ansible runner can SSH into every node.
- Use a Linux distribution supported by Kubespray. As of Kubespray `v2.30.0`, upstream lists Ubuntu 22.04 and 24.04, Debian Bookworm/Bullseye/Trixie, and RHEL-family 9/10 among the supported options.

## 2. Fill the static inventory

Edit `devops/ansible/inventory/test/hosts.yml`:

- Replace the example IPs with the real node addresses.
- Change `ansible_user` if your SSH user is not `ubuntu`.
- Change `ansible_ssh_private_key_file` if your key is not under `$HOME/.ssh/`.
- If you want control-plane nodes to run workloads too, add them under `kube_node`.

## 3. Review cluster defaults

Edit `devops/ansible/inventory/test/group_vars/all.yml`:

- Enable only the addons you actually want. The current file keeps Helm and Metrics Server enabled.

## 4. Bootstrap the Ansible runner

```bash
cd devops/ansible
make bootstrap
```

This creates:

- `.venv/` with the Kubespray-compatible Ansible toolchain
- `.cache/kubespray/` with the pinned Kubespray checkout
- `.ansible/collections/` for repo-local Ansible collections

## 5. Validate the inventory

```bash
cd devops/ansible
make inventory
make ping
make syntax
```

If you prefer passing the key at runtime instead of storing it in `hosts.yml`:

```bash
make ping EXTRA_ARGS="--private-key ~/.ssh/id_ed25519"
```

## 6. Create the cluster

```bash
cd devops/ansible
make cluster
```

The wrapper playbook:

1. Imports Kubespray's `cluster.yml`
2. Runs the local `k8s_postinstall` role so the remote SSH user can use `kubectl`

## 7. Use kubectl on the node

SSH to the control-plane node and use the kubeconfig copied into the remote user's home:

```bash
ssh -i "$HOME/.ssh/lmthing-vm_key.pem" azureuser@135.225.105.98
kubectl get nodes -o wide
kubectl get ns
```

## Common follow-up commands

```bash
cd devops/ansible
make upgrade
make scale
make reset
```
