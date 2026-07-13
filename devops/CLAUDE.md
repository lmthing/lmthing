# devops/ — Infrastructure Runbook (orientation index)

> **`org/docs/` (published at lmthing.org) is the single source of truth for this codebase.**
> Every sentence there is cited to the implementation. This file is a **pointer + runbook**, not a
> knowledge store. When they disagree, `org/docs/` wins; when `org/docs/` disagrees with the code,
> the **code** wins and the doc is a bug.
>
> **A code change is not done until the matching `org/docs/` page is updated in the same change.**
> Read the contract: [`org/docs/SYNC.md`](../org/docs/SYNC.md). Touching k8s manifests, CI, the
> image build, or the local stack ⇒ update [`org/docs/devops/`](../org/docs/devops/README.md) in the
> same commit.

`devops/` provisions and operates the single production cluster that hosts **all** of lmthing: the
`cloud/` backend (Gateway + LiteLLM), the product SPAs, and one compute pod per user. Three layers:
**Terraform** (Azure VMs) → **Kubespray + Ansible** (cluster + platform + secrets) → **ArgoCD**
(GitOps sync of `devops/argocd/`).

## Task Index

| Working on… | Read |
|---|---|
| Terraform, Kubespray, Envoy Gateway, MetalLB/iptables ingress, cert-manager, namespaces, storage, **per-user compute pods**, scaling | [org/docs/devops/infrastructure.md](../org/docs/devops/infrastructure.md) |
| CI (`build-images.yml`), ACR images + digest pinning, ArgoCD sync, manifest inventory, adding an SPA, domain health checks | [org/docs/devops/deploy.md](../org/docs/devops/deploy.md) |
| running the stack on a laptop | [org/docs/devops/local-dev.md](../org/docs/devops/local-dev.md) |
| the gateway / LiteLLM / billing / **tiers** (pod sizing lives in `cloud/gateway/src/lib/tiers.ts`) | [org/docs/cloud/README.md](../org/docs/cloud/README.md) |
| the CLI server the `compute` image runs | [org/docs/cli-api/README.md](../org/docs/cli-api/README.md) |
| overall system + domain map | [org/docs/architecture.md](../org/docs/architecture.md) |
| adding a pricing tier (cross-cutting) | [org/docs/contributing/add-a-tier.md](../org/docs/contributing/add-a-tier.md) |

Ground truth for the manifests themselves is `devops/argocd/`, `devops/terraform/`, `devops/ansible/`.

## Runbook

### First-time setup

```bash
cd devops/terraform
cp terraform.tfvars.example terraform.tfvars   # set subscription_id, region, VM size
az login && terraform init && terraform apply
./scripts/generate-inventory.sh                # writes ansible/inventory/test/hosts.yml

cd ../ansible
make bootstrap                                 # clone Kubespray + venv
make ping                                      # verify SSH to all nodes
make cluster                                   # provision K8s

cp vault.yml.example vault.yml
vim vault.yml                                  # fill every CHANGE_ME (leave Zitadel creds blank)
ansible-vault encrypt vault.yml                # ALWAYS encrypt before committing
make deploy                                    # Postgres + Zitadel + gateway + ArgoCD
```

Vault variables are defined and documented in **`devops/ansible/vault.yml.example`** — that file is
the list; don't keep a second copy of it here.

### Make targets

```bash
# from devops/ — terraform + forwarders (cluster, deploy, deploy-secrets,
#                deploy-argocd, status, argocd-apps, vault-edit)
make tf-plan | tf-apply | tf-destroy | tf-output | tf-inventory
make up | scale-up | scale-down

# from devops/ansible/ — the full set
make bootstrap | ping | syntax | inventory
make cluster | upgrade | scale | reset          # Kubespray
make deploy | deploy-secrets | deploy-argocd    # Ansible roles
make status | routes | argocd-apps              # pods · Gateways/Routes/Certs · sync status
make logs-gateway | logs-litellm | logs-argocd
make argocd-sync APP=lmthing-core
```

`routes`, `argocd-sync`, and the `logs-*` targets exist only in `devops/ansible/Makefile` — the root
`devops/Makefile` does not forward them.

Deploy targets prompt for the vault password. Extra args: `make deploy EXTRA_ARGS="--tags secrets -vv"`.

### Everyday flows

```bash
# changed gateway / SPA / compute source → CI builds, pushes ACR, commits tag, ArgoCD syncs
git push origin main

# changed a K8s manifest → push; ArgoCD polls (~3 min, no webhook). Force:
kubectl -n argocd annotate application lmthing-core argocd.argoproj.io/refresh=hard --overwrite

# changed vault secrets → ArgoCD does NOT manage secrets
ansible-vault edit devops/ansible/vault.yml && make deploy-secrets

# something is broken
make status && make argocd-apps && make routes && make logs-gateway
```

### kubectl (runs on the control plane, over SSH)

`devops/scripts/` wraps this: `cluster-ssh.sh`, `cluster-kubectl.sh`, `cluster-logs.sh`,
`cluster-restart.sh`. They find the key (gitignored terraform output), `chmod 600` it, and quote args
so jsonpath braces survive. Prefer them over a hand-rolled `ssh -i …`.

```bash
./devops/scripts/cluster-kubectl.sh get deployments --all-namespaces -o wide
./devops/scripts/cluster-logs.sh gateway
./devops/scripts/cluster-restart.sh litellm            # ConfigMap edits do NOT roll pods

# or get a shell and run kubectl directly:
./devops/scripts/cluster-ssh.sh

# roll a rebuilt compute image to one user (the /data PVC persists; next
# POST /api/compute/ensure recreates the Deployment)
kubectl delete deployment/lmthing -n user-<id>

# blunt fallback: restart every user compute pod
kubectl get namespaces | grep ^user- | awk '{print $1}' \
  | xargs -I{} kubectl rollout restart deployment/lmthing -n {}
# ...or, from your machine, with a confirmation prompt:
#   ./devops/scripts/cluster-restart.sh --all-user-pods
```

### Scaling a node

```bash
# add: put the node in terraform/terraform.tfvars `nodes`, then
cd devops && make scale-up && cd ansible && make deploy
# also add the new node's public IP to metallb_config.address_pools in group_vars/all.yml

# remove: DRAIN FIRST — make scale-down destroys the VM
kubectl drain node2 --ignore-daemonsets --delete-emptydir-data && kubectl delete node node2
# remove the entry from terraform.tfvars, then
cd devops && make scale-down
```

### Zitadel first-time setup (one-time, after the initial `make deploy`)

Zitadel comes up at `https://auth.lmthing.cloud`; log in with the vault admin credentials, then:

1. **Project** — Projects → New → `lmthing`, enable "Assert Roles on Authentication".
2. **Web app** — Applications → New → Web, name `gateway`, auth method `Basic`, redirect URI
   `https://lmthing.cloud/api/auth/oauth/callback`. Save the Client ID / Secret.
3. **GitHub IDP** — Org Settings → Identity Providers → New → GitHub (GitHub OAuth App callback:
   `https://auth.lmthing.cloud/ui/login/login/externalidp/callback`); activate it on the login
   policy. The IDP ID is auto-discovered by the gateway.
4. **Machine user** — Users → Machine Users → New → `gateway-service`, role `ORG_OWNER`, generate a
   Personal Access Token.
5. Put the PAT, client ID, client secret, and `vault_gateway_jwt_secret`
   (`openssl rand -base64 32`) into the vault, then `make deploy-secrets` — the gateway restarts and
   picks them up.

## Gotchas

- **Encrypt `vault.yml` before committing** — it ships as a plaintext template.
- **Secrets are NOT managed by ArgoCD** — they come from the `cloud_secrets` role; a git push won't
  apply them. Use `make deploy-secrets`.
- **ArgoCD is poll-only (~3-min latency, no git webhook)** — force with the `refresh=hard`
  annotation above. See `.issues/argocd-no-webhook-sync-latency.md`.
- **A ConfigMap change does not roll its pods** — e.g. after editing `litellm.yaml`'s model list,
  `kubectl rollout restart deploy/litellm -n lmthing`.
- **An out-of-bounds symlink anywhere in the repo breaks ALL syncs** — `ComparisonError: repository
  contains out-of-bounds symlinks` blocks core *and* envoy. Check the Application's
  `status.conditions` when a sync mysteriously stops applying.
- **Envoy Gateway needs `extensionApis.enableBackend: true`** (DynamicResolver Backend for per-user
  `/api/*`) **and `enableEnvoyPatchPolicy: true`** (the `gateway-activator` cluster the pod-wake Lua
  calls). Both are Helm values in the `envoy_gateway` role — do not remove them.
- **The `ReferenceGrant` is required** — without it HTTPRoutes in `gateway` cannot reference
  Services in `lmthing`, and routing fails silently.
- **cert-manager HTTP-01 needs port 80 open** — the ACME solver creates temporary routes on the HTTP
  listener.
- **MetalLB is configured but is not the real ingress path** — Azure SDN NATs the public IP, so L2
  ARP can't advertise it. External traffic arrives via the iptables DNAT installed by the
  `ingress_iptables` role (`lmthing-nat.service`). Details:
  [infrastructure.md](../org/docs/devops/infrastructure.md).
- **Pod sizing / `MAX_SESSIONS` are re-patched on every ensure** — `cloud/gateway/src/lib/tiers.ts`
  is the source of truth; a one-off `kubectl set env` gets reverted.
- **LiteLLM is pinned to a concrete version, not a floating tag** — a floating tag plus
  `IfNotPresent` served a stale image, and pre-1.90 builds silently dropped per-key `budget_limits`,
  so tier budget windows were never enforced. Bump the tag deliberately in `argocd/core/litellm.yaml`.
- **The compute image must co-locate `system-spaces` with the cli bundle** — the cli bundles
  `@lmthing/core`, so system-space path resolution is relative to `…/cli/dist/`. Without the copy,
  every chat session fails with `Agent "thing" not found`.
- **`devops/argocd/compute/user-pod-template.yaml` and the `compute-pod-template` ConfigMap are NOT
  the live provisioning path** — the gateway builds the pod objects inline in TypeScript
  (`cloud/gateway/src/lib/compute.ts`). Treat those YAMLs as reference/legacy; edit `compute.ts`.
