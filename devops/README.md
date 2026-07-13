# devops/ — infrastructure

Provisions and operates the single production cluster that hosts all of lmthing: the `cloud/` backend
(Gateway + LiteLLM), the product SPAs, and one compute pod per user. Three layers: **Terraform**
(Azure VMs) → **Kubespray + Ansible** (cluster + platform + secrets) → **ArgoCD** (GitOps sync of
`devops/argocd/`).

> **`org/docs/` (published at lmthing.org) is the single source of truth.** Every sentence there is
> cited to the implementation. This README is a directory map and a pointer — knowledge does not live
> here. Touching k8s manifests, CI, the image build, or the local stack ⇒ update
> [`org/docs/devops/`](../org/docs/devops/README.md) in the same change ([SYNC.md](../org/docs/SYNC.md)).

## Where the answers are

| Working on… | Read |
|---|---|
| Terraform, Kubespray, Envoy Gateway, MetalLB/iptables ingress, cert-manager, namespaces, storage, **per-user compute pods**, scaling | [org/docs/devops/infrastructure.md](../org/docs/devops/infrastructure.md) |
| CI (`build-images.yml`), ACR images + digest pinning, ArgoCD sync, manifest inventory, adding an SPA | [org/docs/devops/deploy.md](../org/docs/devops/deploy.md) |
| running the stack on a laptop | [org/docs/devops/local-dev.md](../org/docs/devops/local-dev.md) |
| the gateway / LiteLLM / billing / tiers | [org/docs/cloud/README.md](../org/docs/cloud/README.md) |
| overall system + domain map | [org/docs/architecture.md](../org/docs/architecture.md) |
| **the runbook** — make targets, first-time setup, everyday flows, Zitadel setup, gotchas | [CLAUDE.md](CLAUDE.md) |
| first cluster walkthrough | [docs/getting-started/kubespray-test.md](docs/getting-started/kubespray-test.md) |

Ground truth for the manifests themselves is the directories below.

## Layout

```
devops/
├── Makefile      # terraform + scaling targets (forwards a subset of ansible/Makefile)
├── CLAUDE.md     # the runbook: make targets, everyday flows, gotchas
├── argocd/       # ArgoCD-managed K8s manifests (GitOps source of truth)
│   ├── apps/     #   ArgoCD Application definitions (lmthing-core, lmthing-envoy)
│   ├── core/     #   → lmthing namespace: litellm, gateway, SPAs
│   ├── envoy/    #   → gateway namespace: Gateways, HTTPRoutes, policies, certs
│   └── compute/  #   per-user compute pod Dockerfile (+ legacy pod template — the
│                 #   live provisioning path is cloud/gateway/src/lib/compute.ts)
├── terraform/    # Azure VM provisioning + generate-inventory.sh → ansible hosts.yml
├── ansible/      # Kubespray playbook + roles (envoy_gateway, argocd, cloud_secrets,
│                 # argocd_apps, ingress_iptables, k8s_postinstall) + vault.yml
└── docs/getting-started/kubespray-test.md
```

## Cluster access

Use the helpers in [`scripts/`](./scripts/) — they locate the key (it is gitignored terraform output),
fix its permissions, and quote args so jsonpath survives the remote shell:

```bash
./devops/scripts/cluster-ssh.sh                 # shell on the node
./devops/scripts/cluster-kubectl.sh get pods -n lmthing
./devops/scripts/cluster-logs.sh gateway
./devops/scripts/cluster-restart.sh gateway
```
