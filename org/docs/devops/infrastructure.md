# Infrastructure — cluster & cloud

The production lmthing stack is a single-node (scalable) Kubernetes cluster on an
Azure VM. The lifecycle has three layers, each owned by a distinct tool:

1. **Terraform** provisions the Azure VMs (`devops/terraform/`).
2. **Kubespray + Ansible** turn those VMs into a K8s cluster and install the cluster-level
   platform (Envoy Gateway, ArgoCD, cert-manager, MetalLB, secrets) (`devops/ansible/`).
3. **ArgoCD** GitOps-syncs the application manifests (`devops/argocd/`) — covered in
   [./deploy.md](./deploy.md).

This file covers layers 1–2 plus the per-user compute pod. For the CI→ACR→ArgoCD deploy
flow, the manifest inventory, and rollout mechanics, see [./deploy.md](./deploy.md); for
`make` targets and local dev, [./local-dev.md](./local-dev.md).

---

## Terraform — Azure VM provisioning

`devops/terraform/` provisions one or more Ubuntu 24.04 VMs plus shared network resources.
Provider is `hashicorp/azurerm ~> 4.0`, Terraform `>= 1.5`, with remote state in an Azure
Storage backend (`resource_group_name = "lmthing-tfstate-rg"`, `storage_account_name =
"lmthingtfstate"`, container `tfstate`, key `lmthing.tfstate`) `devops/terraform/versions.tf:1-30`.

### Shared resources (one per cluster)

Everything is prefixed `${project}-${environment}` → `lmthing-test` by default
`devops/terraform/main.tf:1-2`, `devops/terraform/variables.tf:8-25`.

| Resource | Name | Detail | Citation |
|---|---|---|---|
| Resource Group | `lmthing-test-rg` | region `germanywestcentral` (default) | `main.tf:19-23`, `variables.tf:21-25` |
| Virtual Network | `lmthing-test-vnet` | `10.0.0.0/16` | `main.tf:26-32`, `variables.tf:28-32` |
| Subnet | `lmthing-test-subnet` | `10.0.0.0/24` | `main.tf:34-39`, `variables.tf:34-38` |
| NSG | `lmthing-test-nsg` | firewall rules below | `main.tf:42-125` |

### NSG rules

`devops/terraform/main.tf:48-124`:

| Rule | Port | Source | Purpose |
|---|---|---|---|
| AllowSSH | 22 | `ssh_allowed_ips` or `0.0.0.0/0` | SSH |
| AllowHTTP | 80 | any | ACME HTTP-01 + redirect |
| AllowHTTPS | 443 | any | app traffic |
| AllowK8sAPI | 6443 | VNet only | kube-apiserver |
| AllowK8sInternal | 10250-10260 | VNet only | kubelet, NodePort, CNI |
| AllowEtcd | 2379-2380 | VNet only | etcd |

Port 80 open is a hard requirement — cert-manager's ACME HTTP-01 solver creates temporary
routes on the HTTP listener (see [cert-manager](#tls--cert-manager) below).

### Per-node resources

Terraform iterates `for_each` over `local.all_nodes` (`main.tf:12-16,146-210`); each node gets
a static Standard-SKU public IP, a NIC, an NSG association, and a `azurerm_linux_virtual_machine`.
Image is `Canonical / ubuntu-24_04-lts / server / latest`; OS disk `Premium_LRS`, default 64 GB
`main.tf:197-209`. An optional `Premium_LRS` data disk is attached when `data_disk_size_gb > 0`
`main.tf:213-230`.

The default node set is a single control-plane node `devops/terraform/variables.tf:50-63`:

```hcl
nodes = {
  node1 = { role = "control_plane" }   # vm_size defaults to Standard_B4as_v2
}
```

The default `vm_size` is **`Standard_B4as_v2`** (a burstable ARM SKU) `variables.tf:54` — not a
`D`-series VM. Each node object accepts `role` (`"control_plane"` | `"worker"`), `vm_size`, `os_disk_size_gb`,
and `data_disk_size_gb` `variables.tf:50-63`.

### User pool (Phase 4, default-off)

A second node map, `user_pool_nodes`, adds a dedicated worker pool for user compute pods, but
only when `enable_user_pool = true` `devops/terraform/variables.tf:71-97`. With it `false`
(default), `local.all_nodes = merge(var.nodes, {})` so every `for_each` is byte-identical to the
single-node plan `main.tf:9-16`. Provisioning is a real billable action gated behind explicit
approval — the default is never flipped in `variables.tf` `variables.tf:71-75`. The default pool
node `lmthing-user-pool-1` is a `Standard_B8as_v2` (8 vCPU / 32 GiB) with a 256 GB `Premium_LRS`
data disk `variables.tf:90-96`. It is labelled `lmthing.cloud/pool=user` and tainted
`lmthing.cloud/pool=user:NoSchedule` by the inventory generator (below), so only user-pod
workloads carrying a matching toleration schedule onto it — the toleration is applied by the
gateway's `poolPlacement()` when `COMPUTE_NODE_POOL=user` `cloud/gateway/src/lib/compute.ts:74-130`.

### SSH keys

If `ssh_public_key_path` is empty (default), Terraform generates an RSA-4096 key pair
(`tls_private_key`) and writes the private key to
`terraform/generated/lmthing-test-key.pem` (mode 0600) `main.tf:127-144`. Otherwise it uses the
supplied key. Admin user is `azureuser` `variables.tf:99-103`.

### Outputs

`devops/terraform/outputs.tf` exposes `nodes` (public/private IP + role + size per node),
`resource_group_name`, `ssh_private_key_path`, `admin_username`, and a convenience
`ssh_commands` map `outputs.tf:1-38`. `generate-inventory.sh` consumes `nodes`,
`admin_username`, and `ssh_private_key_path`.

### Terraform → Ansible inventory bridge

`devops/terraform/scripts/generate-inventory.sh` reads `terraform output -json nodes` and writes
a Kubespray `hosts.yml` `generate-inventory.sh:14-94`. Role → Kubespray group mapping:

- `control_plane` → `kube_control_plane` + `etcd` (assigned `etcd_member_name: etcdN`) + `kube_node`
  (control-plane nodes also run workloads) `generate-inventory.sh:56-66`.
- `worker` → `kube_node` only `generate-inventory.sh:67-70`.

A node whose name matches `lmthing-user-pool-*` additionally emits `node_labels`
(`lmthing.cloud/pool: user`) and `node_taints` (`lmthing.cloud/pool=user:NoSchedule`) — native
Kubespray inventory vars applied by the built-in node-label/node-taint roles, no extra role
`generate-inventory.sh:48-54`. The committed single-node inventory is
`devops/ansible/inventory/test/hosts.yml` (node1 @ `4.223.83.5`, private `10.0.0.4`).

---

## Kubespray & Ansible

### Bootstrap

`devops/ansible/scripts/setup/bootstrap.sh` clones **Kubespray v2.30.0** (shallow, by tag) into
`ansible/.cache/kubespray` and installs its Python requirements into a venv
`bootstrap.sh:7-26`. Override with `KUBESPRAY_VERSION` / `KUBESPRAY_REPO`.

### Cluster playbook

`devops/ansible/playbooks/kubespray.yml` imports Kubespray's own `cluster.yml`, then runs the
`k8s_postinstall` role on the control plane `kubespray.yml:1-11`. `k8s_postinstall` copies
`/etc/kubernetes/admin.conf` to the SSH user's `~/.kube/config` and verifies the cluster is
reachable `roles/k8s_postinstall/tasks/main.yml:1-40`.

### Cluster addons (inventory group_vars)

`devops/ansible/inventory/test/group_vars/all.yml` enables the platform addons Kubespray
installs at cluster-creation time:

- `helm_enabled: true`, `metrics_server_enabled: true`
- **cert-manager** — `cert_manager_enabled: true` with
  `cert_manager_controller_extra_args: ["--enable-gateway-api"]` (so cert-manager can solve
  ACME challenges through the Gateway API)
- **MetalLB** — `metallb_enabled: true`, `metallb_speaker_enabled: true`,
  `kube_proxy_strict_arp: true`, with a Layer-2 `primary` pool advertising `4.223.83.5/32`
  (the node's public IP). When scaling, add each node's public IP to `ip_range`.

### Service deployment playbook

`devops/ansible/playbooks/services.yml` runs, in order, five roles `services.yml:1-16`:

| Order | Role | Tags | Does |
|---|---|---|---|
| 1 | `envoy_gateway` | infra, envoy | Install Envoy Gateway (below) |
| 2 | `argocd` | infra, argocd | Install ArgoCD via Helm chart `argo-cd v7.8.13`, namespace `argocd` `roles/argocd/defaults/main.yml` |
| 3 | `cloud_secrets` | secrets | Create `lmthing-secrets` + `acr-pull-secret` K8s secrets from Ansible Vault, run DB migrations (see [./deploy.md](./deploy.md)) |
| 4 | `argocd_apps` | argocd, apps | Apply the ArgoCD `Application`s that bootstrap GitOps (see [./deploy.md](./deploy.md)) |
| 5 | `ingress_iptables` | infra, ingress | DNAT rules for ingress (below) |

Roles run against `kube_control_plane[0]` and read `../vault.yml`. Secrets are managed by the
`cloud_secrets` role and live **outside** ArgoCD `services.yml:11-12`.

---

## Ingress — MetalLB + iptables DNAT

The ingress path on Azure is subtle. MetalLB is enabled (group_vars above), but **MetalLB
Layer-2 ARP cannot advertise the VM's public IP** — Azure's SDN NATs the public IP to the
private IP, so ARP for the public IP never reaches external clients. The real ingress path is
iptables DNAT `devops/ansible/roles/ingress_iptables/tasks/main.yml:1-11`:

- The `ingress_iptables` role finds the Envoy Gateway Service ClusterIP (selected by label
  `gateway.envoyproxy.io/owning-gateway-name=lmthing-gw`) and adds `nat/PREROUTING` DNAT rules
  forwarding `eth0` ports 80 and 443 to that ClusterIP `ingress_iptables/tasks/main.yml:13-47`.
- Persistence is a dedicated `lmthing-nat.service` systemd unit (`ExecStart=/usr/local/bin/lmthing-nat.sh`,
  `After=kubelet.service`), **not** `netfilter-persistent` — the latter would save kube-proxy
  ipsets and fail to restore on boot before kube-proxy runs, dropping all rules
  `ingress_iptables/tasks/main.yml:6-11,49-88`.

So the effective external-traffic path on this cluster is **iptables DNAT + the `lmthing-nat`
systemd unit**, *not* MetalLB L2 advertisement — MetalLB is installed and allocates the
LoadBalancer IP, but its ARP announcements never leave the Azure SDN
`ingress_iptables/tasks/main.yml:1-11`.

---

## Envoy Gateway

Installed by the `envoy_gateway` Ansible role
`devops/ansible/roles/envoy_gateway/tasks/main.yml`:

1. Create namespace `envoy-gateway-system` `main.yml:2-9`.
2. Helm-install the **OCI** chart `oci://docker.io/envoyproxy/gateway-helm`, version
   **`v1.7.1`** (default), into `envoy-gateway-system` `main.yml:11-27` — an OCI ref pulled by
   digest-capable Helm, not a classic `charts.gateway.envoyproxy.io` repo entry. Two extension
   APIs are enabled and are load-bearing:
   - `extensionApis.enableBackend: true` — required for the `DynamicResolver` Backend that
     powers per-user `/api/*` routing; without it those requests fail.
   - `extensionApis.enableEnvoyPatchPolicy: true` — required for `activator-patch.yaml`, the
     `EnvoyPatchPolicy` that injects the `gateway-activator` cluster the pod-wake Lua targets
     `main.yml:23-27`.
3. Wait for the `envoy-gateway` deployment to be ready `main.yml:29-39`.
4. Verify the Gateway API CRDs exist `main.yml:41-44`.
5. Create the `GatewayClass` named **`eg`** (controller
   `gateway.envoyproxy.io/gatewayclass-controller`) `main.yml:46-56`.

### The Gateway object

There is **one** `Gateway`, `lmthing-gw`, in the `gateway` namespace
`devops/argocd/envoy/cloud-gateway.yaml:2-9` (`gatewayClassName: eg`), with an HTTP+HTTPS
listener pair per domain — 13 pairs total: `lmthing.cloud`, `lmthing.computer`,
`auth.lmthing.cloud`, `lmthing.studio`, `lmthing.chat`, `lmthing.app`, `lmthing.com`,
`lmthing.social`, `lmthing.store`, `lmthing.space`, `lmthing.team`, `lmthing.blog`,
`lmthing.casa` (domain placeholders `DOMAIN_PLACEHOLDER` / `COMPUTER_DOMAIN_PLACEHOLDER` /
`AUTH_DOMAIN_PLACEHOLDER` are Kustomize-replaced) `cloud-gateway.yaml:12-105+`. Each HTTPS
listener terminates TLS with a per-domain secret (e.g. `lmthing-cloud-tls`,
`lmthing-computer-tls`, `lmthing-auth-tls`) `cloud-gateway.yaml:26-91`. There are no separate
`cloud-gw` / `computer-gw` Gateways — every domain, including `lmthing.computer`, is a listener
pair on this one object, and every HTTPRoute and policy `targetRef`s it
(`devops/argocd/envoy/activator-patch.yaml`, `targetRef.name: lmthing-gw`).

The HTTPRoutes, policies (Lua per-user routing, JWT), and the pod-wake activator that hang off
this Gateway are inventoried in [./deploy.md](./deploy.md).

---

## TLS — cert-manager

cert-manager is a Kubespray addon (`cert_manager_enabled`, group_vars above). A single
`ClusterIssuer` `letsencrypt-prod` uses ACME **HTTP-01** with the Gateway API solver bound to
`lmthing-gw` `devops/argocd/envoy/tls-certificates.yaml:3-18`
(`server: https://acme-v02.api.letsencrypt.org/directory`, ACME email is Kustomize-replaced from
`ACME_EMAIL_PLACEHOLDER`). One `Certificate` per domain references this issuer and populates the
per-listener TLS secret — `lmthing-auth-tls`, `lmthing-cloud-tls`, `lmthing-computer-tls`,
`lmthing-studio-tls`, `lmthing-app-tls`, `lmthing-chat-tls`, `lmthing-com-tls`, … one per domain
in the Gateway `tls-certificates.yaml:24-123+`.

---

## Storage

**Nothing in this repo provisions a StorageClass.** Both persistent volumes are declared with
`storageClassName` omitted, so each binds through whatever class the cluster marks default:

- Postgres runs as a `StatefulSet` with a `volumeClaimTemplates` PVC `postgres-data`,
  `ReadWriteOnce`, **10 Gi**, no `storageClassName` `devops/argocd/core/postgres.yaml:88-95`.
- Each user pod gets a `user-data` PVC, `ReadWriteOnce`, **1 Gi**, likewise no `storageClassName`
  `cloud/gateway/src/lib/compute.ts#dataPvc`.

The local-path provisioner is **not** a Kubespray addon here. The inventory's addon list enables
only `helm`, `metrics_server`, `cert_manager` and `metallb` — there is no storage toggle in it
`devops/ansible/inventory/test/group_vars/all.yml:1-26`. Kubespray itself (pinned to **v2.30.0**
`devops/ansible/scripts/setup/bootstrap.sh:7-8`) defaults `local_path_provisioner_enabled: false`
and runs the provisioner role only `when: local_path_provisioner_enabled`, so with this inventory
it never runs — in the clone `bootstrap.sh` fetches,
`devops/ansible/.cache/kubespray/roles/kubespray_defaults/defaults/main/main.yml:448` and
`devops/ansible/.cache/kubespray/roles/kubernetes-apps/external_provisioner/meta/main.yml:12-13`.

**Open infra bug — the default StorageClass exists only out-of-band.** The production cluster
*does* have one (`local-path`, provisioner `rancher.io/local-path`, Deployment
`local-path-provisioner:v0.0.30` in namespace `local-path-storage`), but nothing in this repo
creates it: it carries no Helm release, no ArgoCD ownership and no Kubespray labels, its
`last-applied-configuration` is the bare upstream Rancher manifest, and its namespace is ~35 days
younger than the rest of the cluster. It was applied by hand. **A cluster rebuilt from this repo
would have no default StorageClass**, and both PVCs above — the Postgres `postgres-data`
`devops/argocd/core/postgres.yaml:88-95` and every per-user `user-data`
`cloud/gateway/src/lib/compute.ts#dataPvc`, neither of which sets `storageClassName` — would sit
`Pending` forever. Check with `kubectl get storageclass`; the fix is to set
`local_path_provisioner_enabled: true` in `devops/ansible/inventory/test/group_vars/all.yml` so
Kubespray installs it.

---

## Namespace map

| Namespace | Managed by | Contents |
|---|---|---|
| `envoy-gateway-system` | `envoy_gateway` role (Helm) | Envoy Gateway controller + per-Gateway proxy Services `envoy_gateway/tasks/main.yml:2-9` |
| `argocd` | `argocd` role (Helm) | ArgoCD server, controller, repo-server, dex, redis `roles/argocd/defaults/main.yml` |
| `cert-manager` | Kubespray addon | cert-manager controller/webhook/cainjector (group_vars `cert_manager_enabled`) |
| `metallb-system` | Kubespray addon | MetalLB controller + speaker (group_vars `metallb_enabled`) |
| `local-path-storage` | **nothing in this repo** — applied out-of-band | local-path PV provisioner (default StorageClass); see [Storage](#storage) `devops/ansible/inventory/test/group_vars/all.yml:1-26` |
| `lmthing` | ArgoCD (`lmthing-core`) | LiteLLM, gateway/Hono, Postgres, Zitadel, render, and the SPA deployments (`studio` `computer` `chat` `com` `social` `team` `store` `space` `blog` `casa`) `devops/argocd/core/*.yaml`, `core/namespace.yaml:1-3` |
| `gateway` | ArgoCD (`lmthing-envoy`) | `lmthing-gw` Gateway, HTTPRoutes, policies, ReferenceGrant, Certificates `core/namespace.yaml:5-7`, `devops/argocd/envoy/*.yaml` |
| `user-<id>` | gateway (K8s API, live) | one compute pod per user (below) `cloud/gateway/src/lib/compute.ts#namespace` |

`namespace.yaml` creates only `lmthing` and `gateway` `devops/argocd/core/namespace.yaml:1-7`;
the platform namespaces are created by their Helm/addon installers (except `local-path-storage`,
which no code in this repo creates — see [Storage](#storage)), and `user-<id>` namespaces are
created at runtime by the gateway.

---

## Per-user compute pod

Every user (all tiers, provisioned lazily) gets a dedicated pod in its own `user-<id>`
namespace. The pod runs the compute image (`@lmthing/core` QuickJS sandbox + `@lmthing/cli`
multi-session server) on port 8080 — see [./deploy.md](./deploy.md) for the image build.

**The live pod spec is built programmatically in the gateway**, not read from a template file.
`cloud/gateway/src/lib/compute.ts` constructs each object:

- `namespace(userId)` → `user-<id>` with labels `lmthing.cloud/user` + `lmthing.cloud/type=compute`
  `compute.ts:134-146`.
- `acrPullSecret(userId)` → `acr-pull-secret` (`kubernetes.io/dockerconfigjson`) built from
  `ACR_USERNAME`/`ACR_PASSWORD`/`ACR_REGISTRY` env `compute.ts:53-55,148-162`.
- `dataPvc(userId)` → `user-data` PVC, 1 Gi, default StorageClass `compute.ts:164-179`.
- `deployment(userId, pod)` → Deployment `lmthing`, 1 replica, container `compute` on 8080, image
  `COMPUTE_IMAGE`, `envFrom` the optional `user-env` secret, `/data` mounted from the PVC
  `compute.ts:188-273`.
- `service(userId)` → Service `lmthing` (ClusterIP in prod; NodePort under `LOCAL_DEV`) targeting
  8080 `compute.ts:275-290`.

**Legacy YAMLs — do not edit these expecting an effect.** `devops/argocd/compute/user-pod-template.yaml`
and the `compute-pod-template` ConfigMap (`devops/argocd/core/compute-pod-template.yaml`, still
pinning a stale `compute:4f2c11f` image and `emptyDir` spaces) are **not** the provisioning path:
across all of `cloud/gateway/src` the only mention of either is a stale comment
(`compute.ts:132`, "inline — matches k8s/compute/user-pod-template.yaml"); nothing loads or
templates them. `compute.ts` above is the authoritative spec.

**Image & pull policy** `compute.ts:56-73`:
- `COMPUTE_IMAGE_DIGEST` set (CI `sha256:…`) → image `…/compute@<digest>` + `imagePullPolicy: IfNotPresent`
  (immutable ⇒ reuse layers the pre-pull DaemonSet cached).
- unset → `…/compute:latest` + `imagePullPolicy: Always` (re-pull the moving tag on recreate).
- `LOCAL_DEV` → `compute:local`, no pull secret.

A `compute-prepull` DaemonSet (`devops/argocd/core/compute-prepull.yaml`) pins a specific
compute digest onto nodes to warm the layer cache and cut cold-start time; today its nodeSelector
matches no node so it is effectively inert until the user pool exists.

**Pool placement** `compute.ts:115-130`: when `COMPUTE_NODE_POOL` is set (e.g. `user`), the pod
spec gains a `nodeSelector` (`lmthing.cloud/pool`) + a matching `NoSchedule` toleration so it lands
only on the tainted user-pool node (Phase 4). Unset → schedules anywhere (today's single node).

**Sizing** comes from the tier's `PodConfig` in `cloud/gateway/src/lib/tiers.ts` (source of
truth), re-applied on every ensure — not a one-off `kubectl set env`. Free tier is Burstable
(limit `1500m`/`512Mi`, request `50m`/`256Mi`), `idleTtlMinutes: 15`, `maxSessions: 3`
`tiers.ts:109-116`; paid tiers are Guaranteed and larger (Basic `500m`/`768Mi`, Pro `500m`/`1Gi`,
Max `1000m`/`2Gi`) `tiers.ts:131-159`. The gateway sets a `--max-old-space-size` `NODE_OPTIONS`
at ~60% of the memory limit so V8 GCs before the cgroup OOMs `compute.ts:107-113,236-241`.

**Lifecycle — scale-to-zero, not always-on** `compute.ts`:
- Created/woken lazily by `POST /api/compute/ensure` (any tier), which creates the namespace +
  resources on first use or scales the deployment back to 1 `compute.ts:549-573+,671-698+`.
- The pod self-idles after `IDLE_TTL_MINUTES` and is scaled to zero; a backstop idle-sweep in the
  gateway scales down pods whose `lmthing.cloud/last-active` annotation is stale
  (`COMPUTE_SWEEP_STALE_MIN`, default 30 min) `compute.ts:79-88,912-976`.
- Wake path: Envoy Lua `httpCall("gateway-activator", …)` hits `/api/compute/wake`; the
  `gateway-activator` cluster is injected into xDS by the `activator-patch.yaml` EnvoyPatchPolicy
  pointing at `gateway.lmthing.svc.cluster.local` `devops/argocd/envoy/activator-patch.yaml:17-47`.
- A `startupProbe` (not readiness) gates only the boot window, so a busy single-threaded Node
  event loop can't get yanked from Service endpoints mid-session `compute.ts:244-260`.

Pods are therefore **never always-on and never Pro-only**: every tier — `free` included — gets a
pod, it is created on first use rather than at subscription time, and it is scaled to zero (not
deleted) whenever it goes idle `compute.ts:79-88`, `:678`, `:912-976`. A pod is only torn down
namespace-and-all when a Stripe subscription is *deleted* (`deleteUserPod`,
`cloud/gateway/src/routes/webhook.ts:76-103`).

**RBAC** — the gateway runs as ServiceAccount `gateway` (namespace `lmthing`) bound to ClusterRole
`lmthing-compute-manager`, which grants create/delete on namespaces, services, configmaps, PVCs,
secrets (+update/patch), and deployments (+scale) cluster-wide, plus read on pods/events
`devops/argocd/core/gateway.yaml:10-48`.

**K8s API access** `compute.ts:7-24`: in-cluster the gateway uses the auto-mounted service-account
token against `https://kubernetes.default.svc`; local dev talks to `kubectl proxy` when
`K8S_LOCAL_PROXY=true`.

---

## Scaling the cluster

Adding a node: add an entry to `terraform.tfvars` `nodes`, `terraform apply`, regenerate the
inventory (`generate-inventory.sh` emits a `make scale` hint when workers exist
`generate-inventory.sh:105-107`), run Kubespray `scale`, and extend `metallb_config.address_pools`
in group_vars with the new node's public IP. Removing a node: `kubectl drain` + `delete node`
first, then remove from tfvars and destroy. Control-plane scaling triggers etcd membership changes
(each control-plane node is auto-assigned an `etcd_member_name` `generate-inventory.sh:56-59`).

See [./deploy.md](./deploy.md) for the `make` targets that wrap these steps and
[./local-dev.md](./local-dev.md) for running the stack locally.
