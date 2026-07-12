# DevOps — Infrastructure & Deployment

Everything under `devops/` provisions and operates the single production cluster that hosts **all** of lmthing: the `cloud/` backend (Gateway + LiteLLM), the product SPAs, and one compute pod per user. This page is the map; the detail files are:

- **[infrastructure.md](./infrastructure.md)** — Terraform VMs, Kubespray cluster, Envoy Gateway, MetalLB, cert-manager, the routing model, per-user pods, scale-to-zero.
- **[deploy.md](./deploy.md)** — GitOps/ArgoCD flow, the image-build CI, Ansible roles, secrets (Vault), Makefile targets, day-2 operations.
- **[local-dev.md](./local-dev.md)** — running the stack on a laptop.
- **[../cloud/README.md](../cloud/README.md)** — the backend services (Gateway/Hono + LiteLLM) that these manifests deploy.

The authoritative, still-maintained long-form guide lives at [`devops/CLAUDE.md`](../../../devops/CLAUDE.md); the manifests it describes are ground truth under `devops/argocd/`, `devops/terraform/`, and `devops/ansible/`.

## The stack at a glance

| Layer | Technology | Where |
|---|---|---|
| VM provisioning | Terraform (azurerm) | `devops/terraform/main.tf` |
| Cluster | Kubespray v2.30.0 on Ubuntu 24.04 | `devops/ansible/playbooks/kubespray.yml` |
| Ingress | Envoy Gateway (Gateway API) | `devops/argocd/envoy/` |
| Load balancer | MetalLB (L2) | `devops/ansible/inventory/test/group_vars/all.yml` |
| TLS | cert-manager + Let's Encrypt (HTTP-01) | `devops/argocd/envoy/tls-certificates.yaml` |
| GitOps | ArgoCD | `devops/argocd/apps/{core,envoy}.yaml` |
| Images | Azure Container Registry (`lmthingacr.azurecr.io`), built by GitHub Actions | `.github/workflows/build-images.yml` |
| Secrets | Ansible Vault → K8s Secrets (outside ArgoCD) | `devops/ansible/roles/cloud_secrets/tasks/main.yml` |

`devops/` replaces the older single-VM K3s setup in `cloud/`: Traefik → Envoy Gateway, Fly.io machines → per-user K8s pods, shell `deploy.sh` → ArgoCD + Ansible (`devops/CLAUDE.md`, "Key Differences from K3s Setup").

## Namespaces

`devops/argocd/core/namespace.yaml` creates `lmthing` and `gateway`; the rest are created by add-on charts or dynamically by the gateway.

| Namespace | What lives there | Managed by |
|---|---|---|
| `lmthing` | Core services — `postgres`, `zitadel`, `litellm`, `render`, `gateway`, plus the SPA deployments `studio`, `computer`, `chat`, `com`, `social`, `store`, `space`, `team`, `blog`, `casa` | ArgoCD app `lmthing-core` (`devops/argocd/core/kustomization.yaml`) |
| `gateway` | Envoy routing resources — the `lmthing-gw` Gateway, HTTPRoutes, SecurityPolicy/EnvoyExtensionPolicy/EnvoyPatchPolicy, ReferenceGrant, Certificates | ArgoCD app `lmthing-envoy` (`devops/argocd/envoy/kustomization.yaml`) |
| `user-<id>` | One per subscribed user — a `lmthing` Deployment (the compute pod), its `Service`, a `user-data` PVC, and `acr-pull-secret` / `user-env` Secrets | The gateway, via the K8s API (`devops/argocd/compute/user-pod-template.yaml`) |
| `envoy-gateway-system` | Envoy Gateway controller | Helm, `devops/ansible/roles/envoy_gateway/tasks/main.yml` |
| `argocd` | ArgoCD server/controller/repo-server | Helm, `devops/ansible/roles/argocd/tasks/main.yml` |
| `cert-manager`, `metallb-system` | TLS issuer + LB, installed as Kubespray addons | `devops/ansible/inventory/test/group_vars/all.yml` |

> Correction: `devops/CLAUDE.md`'s namespace table lists only LiteLLM/Gateway/Studio/Computer/Chat in `lmthing`. The live `kustomization.yaml` also deploys `postgres.yaml`, `zitadel.yaml`, `render.yaml`, and the `com/social/store/space/team/blog/casa` SPAs into `lmthing`.

Cross-namespace routing (HTTPRoutes in `gateway` → Services in `lmthing`) requires the `ReferenceGrant` in `devops/argocd/envoy/reference-grants.yaml`; without it routing silently fails.

## GitOps / ArgoCD

Two ArgoCD `Application`s watch `github.com/lmthing/lmthing` (`main`) and auto-sync with `prune: true` + `selfHeal: true`:

- **`lmthing-core`** → path `devops/argocd/core` (`devops/argocd/apps/core.yaml`). Syncs core services into `lmthing`. Uses `CreateNamespace=true` + `ServerSideApply=true`, and an `ignoreDifferences` block for the `postgres` StatefulSet's volumeClaimTemplates.
- **`lmthing-envoy`** → path `devops/argocd/envoy` (`devops/argocd/apps/envoy.yaml`). Syncs Envoy routing into `gateway`, with a retry/backoff policy.

The normal change loop: push to `main` → ArgoCD reconciles. ArgoCD is **poll-only (~3-minute latency, no git webhook)**; force with `kubectl -n argocd annotate application lmthing-core argocd.argoproj.io/refresh=hard --overwrite` (see `.issues/argocd-no-webhook-sync-latency.md`). **Secrets are NOT in ArgoCD** — they come from the `cloud_secrets` Ansible role, so vault changes need `make deploy-secrets`, not a git push. Full flow → [deploy.md](./deploy.md).

## Ingress & routing

A single shared Gateway named `lmthing-gw` in the `gateway` namespace fronts every domain (`devops/argocd/envoy/activator-patch.yaml`, `targetRef.name: lmthing-gw`; kustomization replacements all target `lmthing-gw`). Domain values (`domain`, `computerDomain`, `authDomain`, ACME email, Zitadel JWT issuer/JWKS) are held in the `lmthing-envoy-config` ConfigMap (`devops/argocd/envoy/config.yaml`) and injected into manifests via Kustomize `replacements` in `devops/argocd/envoy/kustomization.yaml`.

> Correction: `devops/CLAUDE.md`'s routing diagram implies separate `cloud-gw`/`computer-gw` Gateways. The live setup uses **one** `lmthing-gw` Gateway with per-domain listeners and HTTPRoutes.

Two routing shapes:

- **Static** (`lmthing.cloud` and the product SPAs): HTTP :80 → 301 to HTTPS; HTTPS → `/v1/*` → `litellm:4000`, `/api/*` → `gateway:3000` (`devops/argocd/envoy/cloud-routes.yaml`); SPA hostnames (`com/social/store/space/team/blog/casa`) → their nginx Service :80 (`devops/argocd/envoy/spa-routes.yaml`).
- **Dynamic per-user** (`lmthing.{studio,computer,chat}` + served project-apps): a `SecurityPolicy` validates the gateway-issued **HS256 JWT**, Lua extracts the `sub` claim as the user id, and the request is routed to `lmthing.user-<id>.svc.cluster.local:8080`; `/*` falls through to the static SPA (`devops/argocd/envoy/{computer,studio,chat,app}-{routes,policies}.yaml`). Clients hold gateway JWTs, never Zitadel tokens.

Envoy Gateway must be started with `extensionApis.enableBackend: true` (DynamicResolver Backend for `/api/*`) and `extensionApis.enableEnvoyPatchPolicy: true` (the activator patch below) — both set in `devops/ansible/roles/envoy_gateway/tasks/main.yml`.

## The compute pod image

One image, `lmthingacr.azurecr.io/compute:<sha>`, runs every user's pod. `devops/argocd/compute/Dockerfile` is a two-stage Node 24 build: stage 1 (`corepack`/pnpm) `tsup`-builds `@lmthing/core` → `@lmthing/openclaw-compat` → `@lmthing/cli` and `vp build`s the unified web app from `sdk/org/`; stage 2 ships the dists, `node_modules`, the `system-spaces` (copied to both `libs/core/system-spaces` and `libs/cli/dist/system-spaces` so runtime path resolution finds `thing`), and `apps/web/dist`. Entrypoint: `node /app/libs/cli/dist/cli/bin.js serve --port 8080`, cwd `/data`. The image is built by CI on `sdk/org/**` changes and pinned by digest for the pre-pull DaemonSet. Runtime detail → [../cli-api/README.md](../cli-api/README.md); served app → [../app/README.md](../app/README.md).

## Per-user compute pods

The gateway holds a `gateway` ServiceAccount bound to the `lmthing-compute-manager` ClusterRole, granting it create/delete over namespaces, deployments (+`deployments/scale`), services, secrets, configmaps, PVCs (`devops/argocd/core/gateway.yaml:10-47`). On subscription it reads `devops/argocd/compute/user-pod-template.yaml`, substitutes `USER_ID` / `CPU` / `MEM`, and applies a `user-<id>` Namespace + `user-data` PVC + `lmthing` Deployment + Service.

> Correction: `devops/CLAUDE.md` says the pod is "always-on" with an `emptyDir` volume. The live template mounts a **1Gi `PersistentVolumeClaim`** (`user-data`, `devops/argocd/compute/user-pod-template.yaml:29-42`), and pods now **scale to zero**: when a request hits a scaled-down pod, Envoy Lua fires a fire-and-forget `POST /api/compute/wake` to the always-on gateway, which scales the Deployment 0→1. That path needs the `gateway-activator` cluster injected by the `EnvoyPatchPolicy` in `devops/argocd/envoy/activator-patch.yaml`. Pool-node warm-start uses the `compute-prepull` DaemonSet (`devops/argocd/core/compute-prepull.yaml`), a no-op until a node is labelled `lmthing.cloud/pool=user`.

Pod sizing (CPU/MEM/`MAX_SESSIONS`) is tier-driven and re-patched by the gateway on every chat load, so `cloud/gateway/src/lib/tiers.ts` is the source of truth — a one-off `kubectl set env` gets reverted. `MAX_SESSIONS` defaults to 8 in the image; the gateway overrides per tier.

## Terraform (VMs)

`devops/terraform/main.tf` provisions the Azure substrate: one resource group, VNet (10.0.0.0/16), subnet, and NSG shared per cluster, plus a public IP + NIC + Ubuntu 24.04 VM (and optional data disk) for each entry in the `nodes` map variable (`devops/terraform/variables.tf`). Roles map to Kubespray groups via `devops/terraform/scripts/generate-inventory.sh` (`control_plane` → control-plane+etcd+node, `worker` → node). If no SSH key path is given, Terraform generates an RSA-4096 key into `terraform/generated/`. Outputs expose per-node SSH commands (`devops/terraform/outputs.tf`). Setup, scaling, and NSG rules → [infrastructure.md](./infrastructure.md).

## Operating the cluster

Day-to-day operations run through `devops/ansible/Makefile` (forwarded from `devops/Makefile`): `make cluster` (Kubespray), `make deploy` / `make deploy-secrets` / `make deploy-argocd` (Ansible roles), `make status` / `make routes` / `make argocd-apps` / `make logs-*`. SSH into a node and use `kubectl` directly for ad-hoc inspection (`ssh -i terraform/generated/lmthing-test-key.pem azureuser@<node-ip>`). Common recipes, the full Makefile matrix, and gotchas → [deploy.md](./deploy.md).
