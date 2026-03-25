# DevOps — lmthing Infrastructure

Full infrastructure lifecycle for the lmthing platform: Azure VM provisioning (Terraform), Kubernetes cluster setup (Kubespray), and cloud service deployment via ArgoCD GitOps with Envoy Gateway ingress, cert-manager TLS, and per-user compute pods.

## Full Pipeline

```mermaid
graph LR
    subgraph TF["1. Terraform"]
        VM["Azure VM<br/>Ubuntu 24.04<br/>VNet · NSG · Public IP"]
    end
    subgraph KS["2. Kubespray"]
        K8s["Kubernetes Cluster<br/>containerd · MetalLB<br/>cert-manager · Helm"]
    end
    subgraph AN["3. Ansible + ArgoCD"]
        SVC["Cloud Services<br/>Envoy Gateway · ArgoCD<br/>LiteLLM · Gateway · Compute Pods"]
    end
    TF -->|"generate-inventory.sh"| KS
    KS -->|"make cluster"| AN
    AN -->|"make deploy"| Done["ArgoCD auto-syncs"]
```

## Infrastructure Overview

```mermaid
graph TB
    subgraph Internet["Internet"]
        Users["Users / Clients"]
    end

    subgraph Azure["Azure VM — 135.225.105.98"]
        subgraph K8s["Kubernetes (Kubespray)"]
            subgraph MetalLB["MetalLB Layer 2"]
                LB["LoadBalancer<br/>:80 / :443"]
            end

            subgraph ArgoCDNS["argocd"]
                ArgoCD["ArgoCD Server<br/>GitOps auto-sync"]
            end

            subgraph EGSystem["envoy-gateway-system"]
                EGCtrl["Envoy Gateway<br/>Controller"]
            end

            subgraph GatewayNS["gateway namespace"]
                CloudGW["cloud-gw<br/>Gateway"]
                ComputerGW["computer-gw<br/>Gateway"]
                CloudRoutes["HTTPRoutes<br/>/v1/* · /api/*"]
                ComputerRoutes["HTTPRoutes<br/>/api/* · /*"]
                Policies["Lua Routing<br/>+ JWT Validation"]
                Certs["cert-manager<br/>Certificates"]
            end

            subgraph LmthingNS["lmthing namespace"]
                LiteLLM["LiteLLM<br/>:4000"]
                Gateway["Gateway/Hono<br/>:3000"]
                Computer["Computer SPA<br/>:80"]
                Secrets["K8s Secret<br/>lmthing-secrets"]
            end

            subgraph UserNS["user-{id} namespaces"]
                Pod1["user-abc123<br/>Bun + REPL :8080"]
                Pod2["user-def456<br/>Bun + REPL :8080"]
                PodN["..."]
            end
        end
    end

    subgraph External["External Services"]
        AzureAI["Azure AI Foundry"]
        Supabase["Supabase<br/>Auth + PostgreSQL"]
        Stripe["Stripe<br/>Billing"]
        LE["Let's Encrypt<br/>ACME"]
    end

    Users --> LB
    LB --> CloudGW
    LB --> ComputerGW
    EGCtrl -.-> CloudGW
    EGCtrl -.-> ComputerGW
    CloudGW --> CloudRoutes
    ComputerGW --> ComputerRoutes
    CloudRoutes --> LiteLLM
    CloudRoutes --> Gateway
    ComputerRoutes --> Computer
    ComputerRoutes --> Policies
    Policies --> Pod1
    Policies --> Pod2
    ArgoCD -.->|"syncs"| LmthingNS
    ArgoCD -.->|"syncs"| GatewayNS
    Certs --> LE
    LiteLLM --> AzureAI
    LiteLLM --> Supabase
    Gateway --> Supabase
    Gateway --> Stripe
```

## Routing

```mermaid
graph LR
    subgraph CloudDomain["lmthing.cloud"]
        direction TB
        C80["HTTP :80"] -->|301 redirect| C443["HTTPS :443"]
        C443 -->|"/v1/*"| LiteLLM["LiteLLM :4000<br/>OpenAI-compatible proxy"]
        C443 -->|"/api/*"| GW["Gateway :3000<br/>Auth · Keys · Billing"]
    end

    subgraph ComputerDomain["lmthing.computer"]
        direction TB
        D80["HTTP :80"] -->|301 redirect| D443["HTTPS :443"]
        D443 -->|"/api/*"| JWT{"JWT Validation<br/>(Supabase)"}
        JWT -->|"sub → x-user-id"| Lua{"Lua Script"}
        Lua -->|"user-{id}.svc:8080"| UserPod["Per-User Pod<br/>Bun + REPL"]
        D443 -->|"/*"| SPA["Computer SPA<br/>Static Frontend"]
    end
```

## Per-User Compute

```mermaid
sequenceDiagram
    participant User
    participant Stripe
    participant Gateway as Gateway/Hono
    participant K8sAPI as K8s API
    participant Pod as user-{id} Pod

    Note over User,Pod: Provisioning (Pro tier subscription)
    User->>Stripe: Subscribe to Pro tier
    Stripe->>Gateway: Webhook: subscription.created
    Gateway->>K8sAPI: Create Namespace user-{id}
    Gateway->>K8sAPI: Create Deployment + Service
    K8sAPI-->>Pod: Pod starts (Bun + @lmthing/repl)

    Note over User,Pod: Runtime (authenticated requests)
    User->>Gateway: GET lmthing.computer/api/...
    Note right of Gateway: Envoy validates JWT,<br/>Lua routes to user pod
    Gateway->>Pod: Proxied request
    Pod-->>User: Response (WebSocket / HTTP)

    Note over User,Pod: Teardown (subscription cancelled)
    Stripe->>Gateway: Webhook: subscription.deleted
    Gateway->>K8sAPI: Delete Namespace user-{id}
    K8sAPI-->>Pod: Pod terminated
```

## Deployment Pipeline

```mermaid
graph TD
    subgraph Local["Local Machine"]
        Code["Source Code<br/>cloud/ · computer/ · org/libs/repl/"]
        Vault["vault.yml<br/>(Ansible Vault)"]
    end

    subgraph Ansible["make deploy"]
        R1["1. envoy_gateway<br/>Helm install Envoy Gateway"]
        R2["2. argocd<br/>Helm install ArgoCD"]
        R3["3. cloud_build_images<br/>Build 3 Docker images"]
        R4["4. cloud_secrets<br/>K8s secrets + DB migrations"]
        R5["5. argocd_apps<br/>Bootstrap ArgoCD Applications"]
        R1 --> R2 --> R3 --> R4 --> R5
    end

    subgraph Node["Kubespray Node"]
        Containerd["containerd<br/>gateway · computer · compute images"]
        ArgoCD["ArgoCD<br/>Auto-syncs manifests from git"]
    end

    Code --> R3
    Vault --> R4
    R3 --> Containerd
    R5 --> ArgoCD
```

## Namespace Layout

```mermaid
graph TB
    subgraph Cluster["Kubernetes Cluster"]
        subgraph NS0["argocd"]
            ARGO["ArgoCD Server<br/>+ Controller + Repo Server"]
        end
        subgraph NS1["envoy-gateway-system"]
            EG["Envoy Gateway Controller"]
        end
        subgraph NS2["gateway"]
            GW1["cloud-gw<br/>(Gateway)"]
            GW2["computer-gw<br/>(Gateway)"]
            HR["HTTPRoutes"]
            POL["Policies<br/>Lua + JWT"]
            CERT["Certificates"]
            RG["→ ReferenceGrant"]
        end
        subgraph NS3["lmthing"]
            LL["LiteLLM"]
            HG["Gateway/Hono"]
            CS["Computer SPA"]
            SA["ServiceAccount<br/>+ ClusterRole"]
            SEC["lmthing-secrets"]
        end
        subgraph NS4["user-abc123"]
            UP1["Deployment: lmthing<br/>Bun + REPL"]
            US1["Service: lmthing<br/>:8080"]
        end
        subgraph NS5["user-def456"]
            UP2["Deployment: lmthing<br/>Bun + REPL"]
            US2["Service: lmthing<br/>:8080"]
        end
    end

    ARGO -.->|syncs| NS2
    ARGO -.->|syncs| NS3
    EG -.->|manages| GW1
    EG -.->|manages| GW2
    HR -->|cross-ns via ReferenceGrant| LL
    HR -->|cross-ns via ReferenceGrant| HG
    HR -->|cross-ns via ReferenceGrant| CS
    POL -->|dynamic routing| UP1
    POL -->|dynamic routing| UP2
    SA -->|creates/deletes| NS4
    SA -->|creates/deletes| NS5
```

## Layout

```
devops/
├── Makefile                          # Top-level: terraform + pipeline targets
├── README.md                         # This file
├── CLAUDE.md                         # AI assistant context
├── argocd/                           # ArgoCD-managed K8s manifests (GitOps source of truth)
│   ├── apps/                         # ArgoCD Application definitions
│   │   ├── core.yaml                 # lmthing-core: core services
│   │   └── envoy.yaml                # lmthing-envoy: Envoy Gateway resources
│   ├── core/                         # Core services (→ lmthing namespace)
│   │   ├── kustomization.yaml
│   │   ├── namespace.yaml
│   │   ├── litellm.yaml
│   │   ├── gateway.yaml
│   │   ├── computer.yaml
│   │   └── compute-pod-template.yaml
│   ├── envoy/                        # Envoy Gateway resources (→ gateway namespace)
│   │   ├── kustomization.yaml
│   │   ├── config.yaml               # Domain values for Kustomize replacements
│   │   ├── cloud-gateway.yaml
│   │   ├── cloud-routes.yaml
│   │   ├── computer-routes.yaml
│   │   ├── computer-policies.yaml
│   │   ├── reference-grants.yaml
│   │   └── tls-certificates.yaml
│   └── compute/                      # Per-user compute pod resources
│       ├── Dockerfile
│       └── user-pod-template.yaml
├── terraform/                        # Azure VM provisioning
│   ├── versions.tf                   # Provider config (azurerm ~> 4.0)
│   ├── variables.tf                  # All input variables
│   ├── main.tf                       # RG, VNet, NSG, NIC, VM
│   ├── outputs.tf                    # VM IP, SSH, Ansible integration
│   ├── terraform.tfvars.example      # Variable template
│   └── generate-inventory.sh         # TF outputs → Ansible hosts.yml
├── ansible/
│   ├── Makefile                      # All targets (cluster + services + ArgoCD)
│   ├── ansible.cfg                   # Ansible configuration
│   ├── requirements.yml              # Ansible collections
│   ├── vault.yml                     # Secrets (Ansible Vault)
│   ├── playbooks/
│   │   ├── kubespray.yml             # K8s cluster provisioning
│   │   └── services.yml              # Cloud service deployment
│   ├── roles/
│   │   ├── k8s_postinstall/          # Kubeconfig setup
│   │   ├── envoy_gateway/            # Install Envoy Gateway via Helm
│   │   ├── argocd/                   # Install ArgoCD via Helm
│   │   ├── buildkit/                 # Install BuildKit for image building
│   │   ├── cloud_build_images/       # Build Docker images
│   │   ├── cloud_secrets/            # Create K8s secrets + run DB migrations
│   │   ├── argocd_apps/              # Bootstrap ArgoCD Application definitions
│   │   └── ingress_iptables/         # iptables for MetalLB ingress
│   ├── inventory/test/
│   │   ├── hosts.yml                 # Node inventory (auto-generated from TF)
│   │   └── group_vars/all.yml        # Cluster addons
│   ├── k8s/                          # [LEGACY] Old Ansible-managed manifests (use argocd/ instead)
│   └── scripts/setup/
│       └── bootstrap.sh              # Kubespray + venv setup
└── docs/getting-started/
    └── kubespray-test.md             # Cluster setup guide
```

## Quick Start

### 1. Provision Azure VM

```bash
cd devops/terraform
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars          # Set subscription_id, region, VM size

az login                      # Authenticate to Azure
make -C .. tf-apply           # Or: terraform init && terraform apply

# Generate Ansible inventory from Terraform outputs
./generate-inventory.sh
```

### 2. Provision the Cluster

```bash
cd devops/ansible

# Bootstrap (clone Kubespray v2.30.0, create Python venv)
make bootstrap

# Verify SSH connectivity
make ping

# Deploy K8s cluster
make cluster
```

### 3. Deploy Services

```bash
# Fill in secrets and encrypt
vim vault.yml
ansible-vault encrypt vault.yml

# Update argocd/envoy/config.yaml with your domain values
vim ../argocd/envoy/config.yaml

# Deploy everything (prompts for vault password)
# Installs Envoy Gateway + ArgoCD + builds images + creates secrets + bootstraps ArgoCD apps
make deploy
```

### 4. Verify

```bash
# Check pod status (includes argocd namespace)
make status

# Check ArgoCD sync status
make argocd-apps

# Check routing and TLS
make routes

# Test endpoints
curl https://lmthing.cloud/api/health
curl https://lmthing.cloud/v1/models -H "Authorization: Bearer sk-..."
```

### Ongoing Changes

After initial setup, K8s manifest changes are deployed via GitOps:

```bash
# Edit manifests in devops/argocd/, commit, and push
git push    # ArgoCD auto-syncs within 3 minutes

# Or trigger immediate sync
cd ansible && make argocd-sync APP=lmthing-core
```

## Scaling

```mermaid
graph LR
    subgraph Before["Single Node"]
        N1["node1<br/>control_plane<br/>Standard_D4s_v3"]
    end

    subgraph After["Multi-Node Cluster"]
        N1b["node1<br/>control_plane"]
        N2["node2<br/>worker"]
        N3["node3<br/>worker"]
    end

    Before -->|"1. Add to tfvars<br/>2. make scale-up"| After
```

### Adding a Node

```bash
# 1. Add entry to terraform/terraform.tfvars
nodes = {
  node1 = { role = "control_plane" }
  node2 = { role = "worker" }         # add this
}

# 2. Provision VM + update inventory + join cluster
cd devops
make scale-up

# 3. Build images on new node
cd ansible && make deploy-images
```

### Removing a Node

```bash
# 1. Drain and remove from K8s
kubectl drain node2 --ignore-daemonsets --delete-emptydir-data
kubectl delete node node2

# 2. Remove entry from terraform/terraform.tfvars
# 3. Destroy VM + update inventory
cd devops
make scale-down
```

## Common Operations

All Ansible commands run from `devops/ansible/`. Terraform and scaling from `devops/`.

| Task | Command |
|------|---------|
| **Infrastructure** | |
| Provision VMs | `make tf-apply` |
| Destroy all VMs | `make tf-destroy` |
| Update inventory from TF | `make tf-inventory` |
| Full setup (VMs + inventory) | `make up` |
| Add worker nodes | `make scale-up` |
| Remove worker nodes | `make scale-down` |
| **Cluster** | |
| Bootstrap Ansible | `cd ansible && make bootstrap` |
| Create cluster | `cd ansible && make cluster` |
| Upgrade cluster | `cd ansible && make upgrade` |
| **Services** | |
| Full deploy | `cd ansible && make deploy` |
| Rebuild images only | `cd ansible && make deploy-images` |
| Update secrets + migrations | `cd ansible && make deploy-secrets` |
| Install/update ArgoCD + apps | `cd ansible && make deploy-argocd` |
| **Observability** | |
| Check pod status | `cd ansible && make status` |
| Check routes & certs | `cd ansible && make routes` |
| View gateway logs | `cd ansible && make logs-gateway` |
| View litellm logs | `cd ansible && make logs-litellm` |
| View ArgoCD logs | `cd ansible && make logs-argocd` |
| ArgoCD app sync status | `cd ansible && make argocd-apps` |
| Trigger manual ArgoCD sync | `cd ansible && make argocd-sync APP=lmthing-core` |
| **Secrets** | |
| Edit vault | `ansible-vault edit ansible/vault.yml` |

## Further Reading

- [Cluster Setup Guide](docs/getting-started/kubespray-test.md) — step-by-step first cluster walkthrough
- [CLAUDE.md](CLAUDE.md) — full technical reference (gotchas, RBAC, template rendering, secrets)
- [cloud/README.md](../cloud/README.md) — original K3s backend (being replaced)
