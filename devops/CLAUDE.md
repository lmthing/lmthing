# CLAUDE.md — DevOps Infrastructure Guide

## Project Overview

**devops/** automates the full infrastructure lifecycle: Azure VM provisioning (Terraform), Kubernetes cluster setup (Kubespray + Ansible), and lmthing service deployment (ArgoCD GitOps). It is the successor to the K3s single-VM setup in `cloud/`, replacing Traefik with Envoy Gateway, Fly.io with per-user K8s compute pods, and shell scripts with ArgoCD + Ansible.

**VM Provisioning:** Terraform (Azure RM provider)
**Cluster:** Kubespray v2.30.0 on Azure VM (Ubuntu 24.04)
**Ingress:** Envoy Gateway (Gateway API)
**GitOps:** ArgoCD (auto-syncs K8s manifests from git)
**TLS:** cert-manager + Let's Encrypt (ACME HTTP-01)
**Load Balancer:** MetalLB Layer 2
**Secrets:** Ansible Vault → K8s Secrets (managed outside ArgoCD)
**Container Runtime:** containerd (Kubespray default)

## Architecture

```
MetalLB (L2 ARP — advertises node IP for LoadBalancer Services)
│
Envoy Gateway (Gateway API — sole ingress controller)
├── lmthing.cloud (cloud-gw)
│   ├── /v1/*  → LiteLLM :4000          (lmthing namespace)
│   └── /api/* → Gateway/Hono :3000     (lmthing namespace)
└── lmthing.computer (computer-gw)
    ├── /api/* → JWT → Lua → user-{id} pod :8080  (dynamic per-user routing)
    └── /*     → Computer SPA :80       (lmthing namespace)

cert-manager → ClusterIssuer (letsencrypt-prod) → Certificate per domain
```

### How It Works

1. Terraform provisions Azure VMs (resource group, VNet, NSG, VMs)
2. `generate-inventory.sh` creates Kubespray inventory from Terraform outputs
3. Kubespray provisions K8s cluster with MetalLB + cert-manager addons
4. Envoy Gateway installed via Helm — provides Gateway API CRDs
5. ArgoCD installed via Helm — provides GitOps continuous deployment
6. Ansible creates K8s secrets from Ansible Vault (secrets stay outside git)
7. ArgoCD Applications bootstrap — syncs core services + envoy resources from git
8. ArgoCD auto-syncs `devops/argocd/core/` → `lmthing` namespace (LiteLLM, Gateway, Computer SPA)
9. ArgoCD auto-syncs `devops/argocd/envoy/` → `gateway` namespace (routing, TLS, policies)
10. cert-manager auto-issues Let's Encrypt TLS certs for both domains
11. Per-user compute pods created by Gateway/Hono when user subscribes to Pro tier
12. Envoy Lua script routes `/api/*` requests to `lmthing.user-{id}.svc.cluster.local:8080`
13. Ongoing changes: push to git → ArgoCD auto-syncs (no manual `kubectl apply` needed)

### Key Differences from K3s Setup (cloud/)

| Concern | K3s (cloud/) | Kubespray (devops/) |
|---------|-------------|-------------------|
| Ingress | Traefik IngressRoute CRDs | Envoy Gateway (Gateway API) |
| TLS | Traefik built-in ACME | cert-manager ClusterIssuer |
| LB | N/A | MetalLB Layer 2 |
| Compute | Fly.io Machines | Per-user K8s pods |
| Images | `k3s ctr images import` | `ctr -n k8s.io images import` |
| kubectl | `sudo k3s kubectl` | `kubectl` |
| Deploy | Shell script (`deploy.sh`) | Ansible playbook + Makefile |
| Secrets | `.env.secrets` file | Ansible Vault |

## Namespace Strategy

| Namespace | Purpose | Managed By |
|-----------|---------|------------|
| `envoy-gateway-system` | Envoy Gateway controller | Helm (Ansible role) |
| `argocd` | ArgoCD server, controller, repo-server | Helm (Ansible role) |
| `lmthing` | Core services: LiteLLM, Gateway/Hono, Computer SPA | ArgoCD (`lmthing-core` app) |
| `gateway` | Envoy routing resources: Gateway, HTTPRoute, policies | ArgoCD (`lmthing-envoy` app) |
| `user-{id}` | Per-user compute pods (created dynamically by Gateway/Hono) | Gateway app (K8s API) |

Cross-namespace routing requires a `ReferenceGrant` in `lmthing` allowing HTTPRoutes in `gateway` to reference Services in `lmthing`.

## Project Structure

```
devops/
├── Makefile                                         # Top-level: terraform + pipeline targets
├── README.md
├── CLAUDE.md                                        # This file
├── argocd/                                          # ArgoCD-managed K8s manifests (GitOps source of truth)
│   ├── core/                                        # Core services (synced by ArgoCD → lmthing namespace)
│   │   ├── kustomization.yaml                       # Kustomize entrypoint
│   │   ├── namespace.yaml                           # lmthing + gateway namespaces
│   │   ├── litellm.yaml                             # LiteLLM ConfigMap + Deployment + Service
│   │   ├── gateway.yaml                             # Gateway Deployment + Service + RBAC
│   │   ├── computer.yaml                            # Computer SPA Deployment + Service
│   │   └── compute-pod-template.yaml                # ConfigMap with per-user pod template
│   ├── envoy/                                       # Envoy Gateway resources (synced by ArgoCD → gateway namespace)
│   │   ├── kustomization.yaml                       # Kustomize entrypoint + replacements
│   │   ├── config.yaml                              # ConfigMap with domain values (non-secret)
│   │   ├── cloud-gateway.yaml                       # Gateway listeners for lmthing.cloud + lmthing.computer
│   │   ├── cloud-routes.yaml                        # HTTPRoutes: /v1/* → litellm, /api/* → gateway
│   │   ├── computer-routes.yaml                     # HTTPRoutes: /api/* → dynamic, /* → SPA
│   │   ├── computer-policies.yaml                   # DynamicResolver, Lua routing, JWT (Supabase)
│   │   ├── reference-grants.yaml                    # Cross-namespace ReferenceGrant
│   │   └── tls-certificates.yaml                    # ClusterIssuer + Certificate resources
│   ├── apps/                                        # ArgoCD Application definitions
│   │   ├── core.yaml                                # Application: lmthing-core
│   │   └── envoy.yaml                               # Application: lmthing-envoy
│   └── compute/                                     # Per-user compute pod resources
│       ├── Dockerfile                               # Bun + @lmthing/repl runtime image
│       └── user-pod-template.yaml                   # Template: Namespace + Deployment + Service
├── terraform/                                       # Azure VM provisioning
│   ├── versions.tf                                  # Provider config (azurerm ~> 4.0)
│   ├── variables.tf                                 # All input variables
│   ├── main.tf                                      # Resource group, VNet, NSG, NIC, VM
│   ├── outputs.tf                                   # VM IP, SSH command, Ansible integration
│   ├── terraform.tfvars.example                     # Variable template
│   └── generate-inventory.sh                        # Generate Ansible hosts.yml from TF outputs
├── ansible/
│   ├── Makefile                                     # All targets: cluster, deploy, status, logs, argocd
│   ├── ansible.cfg                                  # Ansible config (roles path includes Kubespray)
│   ├── requirements.yml                             # Ansible collections (kubernetes.core)
│   ├── vault.yml                                    # Ansible Vault secrets (encrypt before use)
│   ├── playbooks/
│   │   ├── kubespray.yml                            # K8s cluster provisioning + postinstall
│   │   └── services.yml                             # Cloud service deployment (ArgoCD + infrastructure)
│   ├── roles/
│   │   ├── k8s_postinstall/tasks/main.yml           # Kubeconfig setup for SSH user
│   │   ├── envoy_gateway/tasks/main.yml             # Install Envoy Gateway via Helm
│   │   ├── argocd/                                  # Install ArgoCD via Helm
│   │   │   ├── tasks/main.yml
│   │   │   └── defaults/main.yml                    # Chart version config
│   │   ├── buildkit/tasks/main.yml                  # Install BuildKit for image building
│   │   ├── cloud_build_images/tasks/main.yml        # Build gateway + computer + compute images
│   │   ├── cloud_secrets/tasks/main.yml             # Create K8s secrets from vault + run DB migrations
│   │   ├── argocd_apps/tasks/main.yml               # Apply ArgoCD Application definitions
│   │   └── ingress_iptables/tasks/main.yml          # iptables DNAT rules for MetalLB
│   ├── inventory/test/
│   │   ├── hosts.yml                                # Node inventory
│   │   └── group_vars/all.yml                       # Cluster addons: Helm, MetalLB, cert-manager
│   ├── k8s/                                         # [LEGACY] Old Ansible-managed manifests (use argocd/ instead)
│   └── scripts/setup/
│       └── bootstrap.sh                             # Clone Kubespray + create venv
└── docs/getting-started/
    └── kubespray-test.md                            # Step-by-step cluster setup guide
```

## Terraform — Azure VM Provisioning

Terraform manages the Azure VMs that form the Kubespray cluster. Supports multi-node clusters via a `nodes` map variable — add entries to scale, remove to shrink. Configuration in `terraform/`.

### Resources Created

**Shared (one per cluster):**

| Resource | Name Pattern | Purpose |
|----------|-------------|---------|
| Resource Group | `lmthing-test-rg` | Container for all resources |
| Virtual Network | `lmthing-test-vnet` | 10.0.0.0/16 address space |
| Subnet | `lmthing-test-subnet` | 10.0.0.0/24 |
| NSG | `lmthing-test-nsg` | Shared firewall rules |

**Per node (`for_each` over `nodes` map):**

| Resource | Name Pattern | Purpose |
|----------|-------------|---------|
| Public IP | `lmthing-test-{node}-pip` | Static IP |
| NIC | `lmthing-test-{node}-nic` | Network interface |
| VM | `lmthing-test-{node}` | Ubuntu 24.04 |
| Data Disk | `lmthing-test-{node}-datadisk` | Optional, Premium SSD |

All resources are tagged with `project`, `environment`, `managed_by: terraform`, `node`, and `role`.

### NSG Rules

| Rule | Port | Source | Purpose |
|------|------|--------|---------|
| AllowSSH | 22 | `ssh_allowed_ips` or `0.0.0.0/0` | SSH access |
| AllowHTTP | 80 | Any | ACME challenges + redirect |
| AllowHTTPS | 443 | Any | Application traffic |
| AllowK8sAPI | 6443 | VNet only | K8s API for node join |
| AllowK8sInternal | 10250-10260 | VNet only | Kubelet, NodePort, CNI |
| AllowEtcd | 2379-2380 | VNet only | etcd cluster communication |

### SSH Key Management

If `ssh_public_key_path` is empty (default), Terraform generates an RSA-4096 key pair and writes it to `terraform/generated/lmthing-test-key.pem`. If a path is provided, it uses the existing key.

### Usage

```bash
cd devops/terraform

# First time
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars     # Set subscription_id, adjust VM size, etc.
terraform init
terraform plan
terraform apply

# Generate Ansible inventory from outputs
./generate-inventory.sh  # Writes to ../ansible/inventory/test/hosts.yml

# Show outputs
terraform output
```

### Top-Level Makefile (devops/Makefile)

| Target | Description |
|--------|-------------|
| `make tf-init` | `terraform init` |
| `make tf-plan` | `terraform plan` |
| `make tf-apply` | `terraform apply` (creates/updates VMs) |
| `make tf-destroy` | `terraform destroy` (destroys all resources) |
| `make tf-output` | Show Terraform outputs |
| `make tf-inventory` | Generate Ansible inventory from Terraform outputs |
| `make up` | Full pipeline: provision VMs + generate inventory |
| `make scale-up` | Add nodes: TF apply + update inventory + Kubespray scale |
| `make scale-down` | Remove nodes: TF apply + update inventory (drain first!) |
| `make cluster` | Forward to `ansible/make cluster` |
| `make deploy` | Forward to `ansible/make deploy` |
| `make status` | Forward to `ansible/make status` |

### Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `subscription_id` | — | Azure subscription ID (required) |
| `project` | `lmthing` | Resource name prefix |
| `environment` | `test` | Environment name |
| `location` | `germanywestcentral` | Azure region |
| `nodes` | `{ node1 = { role = "control_plane" } }` | Map of cluster nodes (see below) |
| `vm_admin_username` | `azureuser` | SSH admin user |
| `ssh_public_key_path` | `""` | Path to SSH public key (empty = auto-generate) |
| `ssh_allowed_ips` | `[]` | CIDR blocks for SSH (empty = open) |

### Nodes Variable

The `nodes` map defines all cluster VMs. Each entry creates a VM with its own public IP, NIC, and optional data disk.

```hcl
nodes = {
  node1 = {
    role              = "control_plane"  # runs etcd + K8s API + workloads
    vm_size           = "Standard_D4s_v3"  # default
    os_disk_size_gb   = 64                 # default
    data_disk_size_gb = 0                  # default, 0 = no data disk
  }
  node2 = {
    role    = "worker"                   # runs workloads only
    vm_size = "Standard_D8s_v3"          # larger for compute pods
  }
}
```

`generate-inventory.sh` maps roles to Kubespray groups:
- `control_plane` → `kube_control_plane` + `etcd` + `kube_node`
- `worker` → `kube_node`

### Authentication

Terraform authenticates to Azure via:
- `az login` (interactive, recommended for dev)
- Service principal env vars: `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`

The `subscription_id` is always required in `terraform.tfvars`.

## Makefile Targets (ansible/)

### Cluster Management

| Target | Description |
|--------|-------------|
| `make bootstrap` | Clone Kubespray v2.30.0, create Python venv, install deps |
| `make inventory` | Show Ansible inventory graph |
| `make ping` | Test SSH connectivity to all nodes |
| `make syntax` | Validate playbook YAML syntax |
| `make cluster` | Provision K8s cluster via Kubespray + postinstall |
| `make upgrade` | Upgrade existing cluster |
| `make scale` | Add/remove nodes |
| `make reset` | Destroy cluster |

### Service Deployment

| Target | Description |
|--------|-------------|
| `make deploy` | Full deploy: infra + images + secrets + ArgoCD apps |
| `make deploy-images` | Rebuild and import Docker images only |
| `make deploy-secrets` | Update K8s secrets from vault + run DB migrations |
| `make deploy-argocd` | Install ArgoCD + apply Application definitions |
| `make status` | Show pods in `lmthing`, `gateway`, and `argocd` namespaces |
| `make routes` | Show Gateways, HTTPRoutes, Certificates |
| `make logs-gateway` | Tail gateway logs (last 50 lines) |
| `make logs-litellm` | Tail litellm logs (last 50 lines) |
| `make logs-argocd` | Tail ArgoCD server logs (last 50 lines) |
| `make argocd-apps` | Show ArgoCD Application sync status |
| `make argocd-sync APP=<name>` | Trigger manual sync for an ArgoCD Application |

All deploy targets prompt for the Ansible Vault password (`--ask-vault-pass`).

Pass extra Ansible args via `EXTRA_ARGS`:
```bash
make deploy EXTRA_ARGS="--tags secrets -vv"
```

## Ansible Roles

### `envoy_gateway`

Installs Envoy Gateway via Helm chart.

1. Add Helm repo (`charts.gateway.envoyproxy.io`)
2. Install `eg/gateway-helm` v1.3.0 into `envoy-gateway-system`
3. Wait for controller deployment ready
4. Verify Gateway API CRDs installed

**Tags:** `infra`, `envoy`

### `argocd`

Installs ArgoCD via Helm chart for GitOps continuous deployment.

1. Create `argocd` namespace
2. Install ArgoCD Helm chart (argo-cd v7.8.13) with insecure mode (TLS at Envoy)
3. Wait for ArgoCD server deployment ready
4. Display initial admin password

**Tags:** `infra`, `argocd`

### `cloud_build_images`

Builds three Docker images on the node and imports into containerd:

| Image | Source | Purpose |
|-------|--------|---------|
| `lmthing/gateway:latest` | `cloud/gateway/` | Hono API gateway |
| `lmthing/computer:latest` | `computer/` | Static SPA (lmthing.computer frontend) |
| `lmthing/compute:latest` | `org/libs/repl/` + `argocd/compute/Dockerfile` | Bun + @lmthing/repl runtime |

Images are built via nerdctl in the `k8s.io` namespace for containerd.

**Tags:** `images`

### `cloud_secrets`

Creates K8s secrets from Ansible Vault and runs database migrations. Secrets are managed outside ArgoCD to keep sensitive values out of git.

1. Create `lmthing-secrets` K8s Secret in `lmthing` namespace from vault variables
2. Sync SQL migrations to node
3. Run migrations against Supabase PostgreSQL
4. Clean up

**Tags:** `secrets`

### `argocd_apps`

Bootstraps ArgoCD Application definitions and verifies sync.

1. Apply ArgoCD Application for core services (`devops/argocd/apps/core.yaml`)
2. Apply ArgoCD Application for Envoy Gateway resources (`devops/argocd/apps/envoy.yaml`)
3. Wait for ArgoCD to sync the core application
4. Wait for core service rollouts (litellm, gateway, computer)
5. Verify compute image is available

After this role runs, ArgoCD manages all K8s manifests. Push changes to git and ArgoCD auto-syncs.

**Tags:** `argocd`, `apps`

## Routing

### lmthing.cloud — Static Routing

```
Client → Envoy Gateway (cloud-gw)
  HTTP :80  → 301 redirect to HTTPS
  HTTPS :443 → HTTPRoute:
    /v1/*  → litellm:4000   (LiteLLM — OpenAI-compatible proxy)
    /api/* → gateway:3000   (Gateway/Hono — auth, keys, billing)
  TLS: cert-manager auto-issued Let's Encrypt cert
```

Resources: `argocd/envoy/cloud-gateway.yaml`, `argocd/envoy/cloud-routes.yaml`

### lmthing.computer — Dynamic Per-User Routing

```
Client → Envoy Gateway (computer-gw)
  HTTP :80  → 301 redirect to HTTPS
  HTTPS :443 → HTTPRoute:
    /api/* → SecurityPolicy validates Supabase JWT
           → Lua extracts `sub` claim as user_id
           → Routes to lmthing.user-{id}.svc.cluster.local:8080
    /*     → computer:80 (static SPA frontend)
  TLS: cert-manager auto-issued Let's Encrypt cert
```

Resources: `argocd/envoy/computer-routes.yaml`, `argocd/envoy/computer-policies.yaml`

**JWT configuration** (in `computer-policies.yaml`):
- Issuer: Supabase project URL + `/auth/v1`
- Audience: `authenticated`
- Claim: `sub` (Supabase user UUID) → `x-user-id` header
- JWKS: Supabase `.well-known/jwks.json`
- Extracts from `Authorization: Bearer` header or `access_token` query param

## Per-User Compute Pods

**Runtime:** Custom image — Bun + `@lmthing/repl` (streaming TypeScript REPL agent from `org/libs/repl/`) + user spaces (GitHub-syncable).

**Lifecycle:** Always-on. Created when user subscribes to Pro tier (Stripe webhook), destroyed on subscription cancellation.

Each user gets:
```
Namespace: user-{user_id}
  Deployment: lmthing (1 replica, 1 core / 1GB)
  Service: lmthing → port 8080
```

**Pod creation** is handled by Gateway/Hono via the K8s API. The gateway has a ServiceAccount (`gateway`) with a ClusterRole (`lmthing-compute-manager`) granting permissions to create/delete namespaces, deployments, and services.

**Template:** `k8s/compute/user-pod-template.yaml` — stored in a ConfigMap, read by the gateway at pod creation time. `USER_ID` placeholders are replaced with the actual user ID.

## Secrets Management

Secrets are managed via **Ansible Vault** (`vault.yml`).

```bash
# First time: fill in values, then encrypt
vim devops/ansible/vault.yml
ansible-vault encrypt devops/ansible/vault.yml

# Edit encrypted vault
ansible-vault edit devops/ansible/vault.yml

# Deploy (prompts for vault password)
make deploy
```

### Vault Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `vault_domain` | templates | Primary domain (lmthing.cloud) |
| `vault_computer_domain` | templates | Computer domain (lmthing.computer) |
| `vault_base_url` | gateway | Full URL for Stripe redirects |
| `vault_acme_email` | cert-manager | Let's Encrypt contact email |
| `vault_azure_api_key` | litellm | Azure AI Foundry authentication |
| `vault_azure_api_base` | litellm | Azure AI Foundry endpoint |
| `vault_supabase_url` | gateway | Supabase project URL |
| `vault_supabase_service_role_key` | gateway | Supabase admin access |
| `vault_database_url` | litellm | PostgreSQL connection (session pooler, port 5432) |
| `vault_db_password` | migrations | Database password for psql |
| `vault_stripe_secret_key` | gateway | Stripe API access |
| `vault_stripe_webhook_secret` | gateway | Stripe webhook signature verification |
| `vault_stripe_price_starter` | gateway | Stripe price ID for Starter tier |
| `vault_stripe_price_basic` | gateway | Stripe price ID for Basic tier |
| `vault_stripe_price_pro` | gateway | Stripe price ID for Pro tier |
| `vault_stripe_price_max` | gateway | Stripe price ID for Max tier |
| `vault_litellm_master_key` | both | LiteLLM admin API authentication |

## Development Workflow

### First-Time Setup

```bash
# 1. Provision Azure VM
cd devops/terraform
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars          # Set subscription_id, region, VM size
az login                      # Authenticate to Azure
terraform init && terraform apply

# 2. Generate Ansible inventory from Terraform
./generate-inventory.sh

# 3. Bootstrap Ansible + Kubespray
cd ../ansible
make bootstrap

# 4. Verify connectivity
make ping

# 5. Provision K8s cluster
make cluster

# 6. Fill in vault secrets and encrypt
vim vault.yml
ansible-vault encrypt vault.yml

# 7. Deploy services
make deploy
```

### Typical Workflows

**"I changed gateway code"**
```bash
make deploy-images        # rebuilds all images on node
# ArgoCD will detect the new image and restart pods (imagePullPolicy: IfNotPresent)
# If needed, trigger a manual restart via kubectl rollout restart
```

**"I changed K8s manifests"**
```bash
git push                  # push changes to git
# ArgoCD auto-syncs within 3 minutes (or manually: make argocd-sync APP=lmthing-core)
```

**"I want to rebuild just images"**
```bash
make deploy-images
```

**"Something is broken"**
```bash
make status               # check pod status (includes argocd namespace)
make argocd-apps          # check ArgoCD sync status
make logs-gateway         # check gateway logs
make logs-litellm         # check litellm logs
make logs-argocd          # check ArgoCD server logs
make routes               # check gateways, routes, certs
```

**"I changed vault secrets"**
```bash
ansible-vault edit vault.yml
make deploy-secrets       # updates K8s secrets + restarts affected pods
```

**"I need more capacity"**
```bash
# Add node2 to terraform/terraform.tfvars
cd devops
make scale-up             # provisions VM + joins cluster
cd ansible
make deploy-images        # build images on new node
```

**"I need to remove a node"**
```bash
kubectl drain node2 --ignore-daemonsets --delete-emptydir-data
kubectl delete node node2
# Remove node2 from terraform/terraform.tfvars
cd devops
make scale-down           # destroys VM + updates inventory
```

### SSH to Nodes

```bash
# Get SSH commands for all nodes
cd devops && make tf-output

# Or SSH directly (IP from terraform output)
ssh -i terraform/generated/lmthing-test-key.pem azureuser@<node-ip>

# On the node:
kubectl get pods -n lmthing
kubectl get pods -n gateway
kubectl get gateways -A
kubectl logs deployment/gateway -n lmthing --tail=50
```

## K8s Manifests (ArgoCD-managed)

All K8s manifests live in `devops/argocd/` and are synced by ArgoCD from git. No manual `kubectl apply` needed for ongoing changes.

### Core Services (`argocd/core/`)

| File | Kind | Namespace | Purpose |
|------|------|-----------|---------|
| `namespace.yaml` | Namespace | — | Creates `lmthing` + `gateway` |
| `litellm.yaml` | ConfigMap + Deployment + Service | lmthing | LiteLLM proxy (Azure Foundry, budget enforcement) |
| `gateway.yaml` | ServiceAccount + ClusterRole + Deployment + Service | lmthing | Gateway/Hono + RBAC for user pod management |
| `computer.yaml` | Deployment + Service | lmthing | Computer SPA (nginx, COEP/COOP headers) |
| `compute-pod-template.yaml` | ConfigMap | lmthing | Per-user compute pod template |
| `kustomization.yaml` | Kustomization | lmthing | Kustomize entrypoint |

### Envoy Gateway (`argocd/envoy/`)

| File | Kind | Namespace | Purpose |
|------|------|-----------|---------|
| `config.yaml` | ConfigMap | gateway | Domain values for Kustomize replacements |
| `cloud-gateway.yaml` | Gateway | gateway | Listeners for lmthing.cloud + lmthing.computer |
| `cloud-routes.yaml` | HTTPRoute ×3 | gateway | Redirect + /v1 → litellm + /api → gateway |
| `computer-routes.yaml` | HTTPRoute ×3 | gateway | Redirect + /api → dynamic + /* → SPA |
| `computer-policies.yaml` | Backend + HTTPRouteFilter + EnvoyExtensionPolicy + SecurityPolicy | gateway | Dynamic routing + Lua + JWT |
| `reference-grants.yaml` | ReferenceGrant | lmthing | Cross-namespace backend access |
| `tls-certificates.yaml` | ClusterIssuer + Certificate ×2 | — / gateway | Let's Encrypt + per-domain certs |
| `kustomization.yaml` | Kustomization | — | Kustomize entrypoint + replacements |

### ArgoCD Applications (`argocd/apps/`)

| File | Application Name | Syncs From | Purpose |
|------|-----------------|------------|---------|
| `core.yaml` | `lmthing-core` | `devops/argocd/core/` | Core services (auto-sync, self-heal, prune) |
| `envoy.yaml` | `lmthing-envoy` | `devops/argocd/envoy/` | Envoy Gateway resources (auto-sync, self-heal) |

### Compute (`argocd/compute/`)

| File | Purpose |
|------|---------|
| `Dockerfile` | Bun + @lmthing/repl runtime image |
| `user-pod-template.yaml` | Template for per-user Namespace + Deployment + Service |

## Domain Configuration (Kustomize Replacements)

Domain values are configured in `argocd/envoy/config.yaml` (a ConfigMap) and injected into envoy manifests via Kustomize `replacements` in `argocd/envoy/kustomization.yaml`. This replaces the old `envsubst` + `.yaml.tpl` approach.

| ConfigMap Key | Example Value | Injected Into |
|---------------|---------------|---------------|
| `domain` | `lmthing.cloud` | Gateway hostnames, HTTPRoute hostnames, Certificate dnsNames |
| `computerDomain` | `lmthing.computer` | Gateway hostnames, HTTPRoute hostnames, Certificate dnsNames |
| `acmeEmail` | `admin@lmthing.cloud` | ClusterIssuer ACME email |
| `supabaseJwtIssuer` | `https://xxx.supabase.co/auth/v1` | SecurityPolicy JWT issuer |
| `supabaseJwksUri` | `https://xxx.supabase.co/auth/v1/.well-known/jwks.json` | SecurityPolicy JWKS URI |

To update domain values: edit `argocd/envoy/config.yaml`, push to git, ArgoCD auto-syncs.

## Gotchas

- **Encrypt vault.yml before committing** — the file ships as plaintext template. Run `ansible-vault encrypt vault.yml` after filling in real values.
- **Secrets are NOT managed by ArgoCD** — secrets are created by the `cloud_secrets` Ansible role. If you change vault secrets, run `make deploy-secrets` (ArgoCD won't pick up secret changes from git).
- **Update `argocd/envoy/config.yaml` before first deploy** — set your actual domain values and Supabase project reference.
- **ArgoCD auto-sync delay** — ArgoCD polls git every 3 minutes by default. Use `make argocd-sync APP=<name>` for immediate sync.
- **MetalLB IP must match node's external IP** — `metallb_ip_range` in group_vars must contain the node's public IP for LoadBalancer Services to be reachable.
- **ReferenceGrant is required** — without it, HTTPRoutes in `gateway` namespace cannot reference Services in `lmthing` namespace. Cross-namespace routing silently fails.
- **cert-manager HTTP-01 needs port 80 open** — the ACME solver creates temporary HTTPRoutes on the HTTP listener. Ensure the Gateway's HTTP listener exists and firewall allows port 80.
- **Image import uses containerd** — Kubespray uses standard containerd. Build with `nerdctl -n k8s.io build`.
- **Session pooler for DATABASE_URL** — must use Supabase port 5432 (session mode), not 6543 (transaction mode).
- **Gateway ServiceAccount is critical** — the gateway needs the `lmthing-compute-manager` ClusterRole to create user pods. Without it, Pro tier subscriptions will fail to provision compute.
- **Old manifests in `ansible/k8s/`** — these are legacy from the pre-ArgoCD setup. All active manifests are now in `argocd/`. Do not edit files in `ansible/k8s/`.

## Scaling the Cluster

### Adding a Node

```bash
# 1. Add entry to terraform/terraform.tfvars
nodes = {
  node1 = { role = "control_plane" }
  node2 = { role = "worker", vm_size = "Standard_D4s_v3" }  # new
}

# 2. Provision VM + update inventory + join cluster (one command)
cd devops
make scale-up

# 3. Update MetalLB IP range in group_vars/all.yml if needed
# (add new node's public IP to metallb_ip_range)
```

### Removing a Node

```bash
# 1. Drain and remove from K8s first
kubectl drain node2 --ignore-daemonsets --delete-emptydir-data
kubectl delete node node2

# 2. Remove entry from terraform/terraform.tfvars
# 3. Destroy VM + update inventory
cd devops
make scale-down
```

### Scaling Gotchas

- **Always drain before removing** — `make scale-down` destroys the VM. If you don't drain first, pods are abruptly killed.
- **MetalLB IP range** — after adding nodes, update `metallb_ip_range` in `group_vars/all.yml` to include all node public IPs that should receive LoadBalancer traffic.
- **Control plane scaling** — adding control plane nodes requires etcd membership changes. Kubespray handles this via `make scale`, but verify etcd health after.
- **Image availability** — newly joined nodes don't have locally-built images. Run `make deploy-images` after scaling to build images on all nodes.

## VM Configuration

VMs are provisioned by Terraform with these defaults:

| Property | Default |
|----------|---------|
| OS | Ubuntu 24.04 LTS |
| Size | Standard_D4s_v3 (4 vCPU, 16 GB) |
| OS Disk | 64 GB Premium SSD |
| SSH user | azureuser |
| SSH key | Auto-generated in `terraform/generated/` or provided via `ssh_public_key_path` |
| K8s version | Kubespray v2.30.0 default |
| Build artifacts | `/tmp/lmthing-*` (ephemeral, cleaned after deploy) |
