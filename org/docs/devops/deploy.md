# CI/CD & Deploying

lmthing ships via **GitHub Actions → ACR → git-committed image tags → ArgoCD GitOps**. There is no manual `kubectl apply` in the steady state: push source to `main`, CI builds and pushes SHA-tagged images to Azure Container Registry, auto-commits the new tags into the ArgoCD manifests, and ArgoCD reconciles the cluster to match git. Cluster/infra provisioning (Terraform + Kubespray + Ansible) is covered in [./infrastructure.md](./infrastructure.md); this file covers the build + deploy pipeline.

The full loop, per [devops/CLAUDE.md](../../../devops/CLAUDE.md) "How It Works" step 13:

```
push to main ──▶ build-images.yml ──▶ ACR (lmthingacr.azurecr.io/<img>:<sha> + :latest)
                        │
                        ├──▶ commit new tag into devops/argocd/core/<img>.yaml  [skip ci]
                        ├──▶ commit build metadata into gh-pages/data/builds/   [skip ci]
                        └──▶ (best-effort) POST ArgoCD sync
                                             │
                            ArgoCD lmthing-core / lmthing-envoy Applications
                            auto-sync git ──▶ reconcile lmthing / gateway namespaces
```

## GitHub Workflows

Five workflows live in [.github/workflows/](../../../.github/workflows):

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Build and Push Images | `build-images.yml` | push to `main` (source paths) + `workflow_dispatch` | Build changed Docker images, push to ACR, commit new tags, trigger sync |
| Deploy Status Page to GitHub Pages | `deploy-ghpages.yml` | push to `main` under `gh-pages/**` + `workflow_dispatch` | Publish the build-status page (NOT the product SPAs) |
| Design tokens | `design-tokens.yml` | PR + push to `main` (frontend paths) | Hard gate: fail on raw colors / non-token styling |
| PR manual decline | `pr-decline.yml` | PR labeled + `workflow_dispatch` | Canned-message close of PRs by maintainer label |
| Close stale threads | `stale.yml` | daily cron `0 9 * * *` | Mark/close inactive issues |

### `build-images.yml` — the deploy pipeline

Triggered on push to `main` filtered to source paths (`cloud/gateway/**`, `sdk/org` + `sdk/org/**`, `com/**`, `social/**`, `store/**`, `org/**`, `space/**`, `team/**`, `blog/**`, `casa/**`, `devops/argocd/compute/Dockerfile`) plus the monorepo-root workspace anchors `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.dockerignore` `.github/workflows/build-images.yml:10-35`. Also runnable manually via `workflow_dispatch` with an optional comma-separated `images` filter `.github/workflows/build-images.yml:3-9`.

Runs are serialized per branch — `concurrency: build-images-${{ github.ref }}` with `cancel-in-progress: false`, because both the build-data and manifest-tag jobs push to `main` and overlapping runs would race on the ref `.github/workflows/build-images.yml:40-42`.

Four jobs, in order:

**1. `detect`** — checks out with `submodules: recursive` and `fetch-depth: 2` `.github/workflows/build-images.yml:51-55`, then:
- `dorny/paths-filter@v3` computes a per-image changed flag. Every root-context image ANDs a shared `_root` anchor (the workspace files) with its own path so a lockfile sync rebuilds all web surfaces; `compute` deliberately omits `_root` because it builds from the `sdk/org` submodule with its own lockfile `.github/workflows/build-images.yml:57-132`.
- Sets the image tag to the short SHA: `git rev-parse --short HEAD` `.github/workflows/build-images.yml:134-136`.
- A Python step emits a JSON `matrix` of `{image, dockerfile, context, manifest}` entries for changed images (or, on dispatch, the `images` filter or all) `.github/workflows/build-images.yml:138-189`. The full image table:

| image | dockerfile | context | manifest updated |
|---|---|---|---|
| gateway | `cloud/gateway/Dockerfile` | `cloud/gateway` | `devops/argocd/core/gateway.yaml` |
| computer | `sdk/org/apps/web/Dockerfile` | `.` | `devops/argocd/core/computer.yaml` |
| compute | `devops/argocd/compute/Dockerfile` | `sdk/org` | `devops/argocd/core/compute-pod-template.yaml` |
| studio | `sdk/org/apps/web/Dockerfile` | `.` | `devops/argocd/core/studio.yaml` |
| chat | `sdk/org/apps/web/Dockerfile` | `.` | `devops/argocd/core/chat.yaml` |
| com/social/store/org/space/team/blog/casa | `<app>/Dockerfile` | `.` | `devops/argocd/core/<app>.yaml` |

(from the `all_images` list `.github/workflows/build-images.yml:168-182` — 13 images: gateway, computer, compute, studio, chat and the eight product SPAs, `org` included). Studio, computer, and chat share one Dockerfile (`sdk/org/apps/web/Dockerfile`) and one build context (repo root `.`) — the same unified SPA image, deployed as three Deployments for three domains.

**2. `build`** — matrix job over the detected images (`fail-fast: false`) `.github/workflows/build-images.yml:191-200`:
- Azure login (`AZURE_CREDENTIALS` secret) → `az acr login --name lmthingacr` `.github/workflows/build-images.yml:211-217`.
- `docker/build-push-action@v5` pushes **two tags** per image — `:<sha>` and `:latest` — with a registry-backed build cache (`buildcache` ref, `mode=max`) `.github/workflows/build-images.yml:219-230`.
- Records build metadata (image, sha, `sha256:` digest, run id/number/url, conclusion, timestamp) to `build-data/<image>.json` and uploads it as artifact `build-data-<image>` `.github/workflows/build-images.yml:232-277`.

**3. `publish-build-data`** (`needs: [detect, build]`, `if: always()`) — downloads all `build-data-*` artifacts, writes per-service latest JSON + a rolling `history.json` (deduped by SHA, capped at 50) under `gh-pages/data/builds/`, and commits them to `main` with `[skip ci]` `.github/workflows/build-images.yml:279-353`. That commit under `gh-pages/**` is what later fires `deploy-ghpages.yml`.

**4. `update-manifests`** (`needs: [detect, build, publish-build-data]`) — depends on `publish-build-data` only to serialize the two jobs' pushes to `main` `.github/workflows/build-images.yml:355-365`. It:
- Re-downloads the build-data artifacts and only rewrites manifests for images whose artifact records `conclusion == 'success'` — a failed image (e.g. compute) is skipped so its stale tag stays put `.github/workflows/build-images.yml:390-404`.
- For each built image, regex-replaces `image: lmthingacr.azurecr.io/<img>:<old>` with the new SHA in that image's manifest `.github/workflows/build-images.yml:405-412`.
- **Compute is special**: when `compute` is rebuilt it also patches `COMPUTE_IMAGE_TAG` (and, when a digest was captured, `COMPUTE_IMAGE_DIGEST`) in `devops/argocd/core/gateway.yaml`, and pins the `compute-prepull` DaemonSet image by digest in `devops/argocd/core/compute-prepull.yaml` `.github/workflows/build-images.yml:413-449`.
- Commits the `devops/argocd/core/` changes to `main` with message `ci: update image tags to <sha> [skip ci]`, then `git pull --rebase` + `git push` `.github/workflows/build-images.yml:452-461`.
- Finally, a best-effort ArgoCD sync `POST $ARGOCD_SERVER_URL/api/v1/applications/lmthing/sync` guarded by an empty-URL short-circuit and `|| true` `.github/workflows/build-images.yml:463-472`.

**The sync-trigger step is dead code — reconciliation actually happens via ArgoCD's polling loop.** The curl POSTs to `/api/v1/applications/lmthing/sync`, i.e. an Application named `lmthing` `.github/workflows/build-images.yml:469`, but no such Application exists: the repo defines exactly two, `lmthing-core` `devops/argocd/apps/core.yaml:2-4` and `lmthing-envoy` `devops/argocd/apps/envoy.yaml:2-4` (they are the only `kind: Application` manifests in the tree), and the Ansible bootstrap applies only those two `devops/ansible/roles/argocd_apps/tasks/main.yml:5-22`. So against a cluster provisioned by this repo the POST would 404 — and both `[ -z "$ARGOCD_SERVER_URL" ] && exit 0` and the trailing `|| true` swallow the failure `.github/workflows/build-images.yml:468-472`. Net effect: the deploy always waits on ArgoCD's poll (see [Sync latency](#sync-latency--forcing-a-sync) below), which is exactly the symptom recorded in `.issues/argocd-no-webhook-sync-latency.md`. (A correct URL would be `/api/v1/applications/lmthing-core/sync`.)

### `deploy-ghpages.yml` — status page only

Publishes the `gh-pages/` directory (a build-status page: `index.html` + `data/`) to GitHub Pages using `actions/upload-pages-artifact` + `actions/deploy-pages`. Triggered by pushes to `main` touching `gh-pages/**` (which the `publish-build-data` job produces) or manual dispatch `.github/workflows/deploy-ghpages.yml:3-9,36-43`. Concurrency group `"pages"`, no cancel-in-progress `.github/workflows/deploy-ghpages.yml:19-21`.

> This is the ONLY thing on GitHub Pages today. The product SPAs are NOT hosted on Pages — they are K8s Deployments served by ArgoCD (see below). (Corrects the legacy GitHub-Pages-hosting model still embedded in `.etc/scripts/check-domains.sh`.)

### `design-tokens.yml` — the styling hard gate

On PRs and pushes to `main` touching frontend paths (`sdk/org/**`, `com/**`, `social/**`, `team/**`, `store/**`, `space/**`, `blog/**`, `casa/**`), runs `node sdk/org/libs/css/scripts/lint-design-tokens.mjs` over the SPA and shared-lib source trees (`sdk/org/libs/{css,ui}/src`, `sdk/org/apps/web/src`, and each SPA's `src/`); a raw color (hex / literal `rgb()`/`hsl()` / stock Tailwind color utility) fails the build `.github/workflows/design-tokens.yml:6-43`. Note the newest SPA, `org/`, is **not** yet in either the trigger paths or the lint argument list `.github/workflows/design-tokens.yml:9-16,20-27,40-43` — it is currently ungated. Rules & escape hatches: [../design-system/README.md](../design-system/README.md).

### Repo-hygiene workflows

- **`pr-decline.yml`** — on a PR labeled `Close PR: Out of scope | Low info | Duplicate | Spam` (or manual dispatch with a `reason` choice), posts a canned message via `gh pr comment` and closes it with `gh pr close` `.github/workflows/pr-decline.yml:32-135`. (The canned message text still references "Design OS"/`buildermethods/design-os` URLs `.github/workflows/pr-decline.yml:24-25,90` — template residue.)
- **`stale.yml`** — daily `actions/stale@v9`: issues go stale after 30 days, close after 7 more, `bug`-labeled issues exempt `.github/workflows/stale.yml:4-25`.

## Image build & tagging

- **Registry:** `lmthingacr.azurecr.io` (Azure Container Registry). Every deployment and user pod pulls with `imagePullSecrets: [acr-pull-secret]`, e.g. `devops/argocd/core/chat.yaml:16-17`.
- **Tags:** each build pushes `:<short-sha>` (immutable, what manifests pin) and `:latest` (moving) `.github/workflows/build-images.yml:226-228`.
- **Cache:** registry `buildcache` layer cache, `mode=max` `.github/workflows/build-images.yml:229-230`.
- **`imagePullPolicy`:** SPA/core deployments pin a SHA tag with `IfNotPresent` (e.g. `devops/argocd/core/chat.yaml:20-21`). Per-user compute pods track moving `compute:latest` with `Always` — so a recreated pod always re-pulls (see [devops/CLAUDE.md](../../../devops/CLAUDE.md) gotchas; digest-pinning path below is the fast-cold-start alternative).

### Compute image digest pinning (fast cold-start)

CI writes both a tag and a digest for the `compute` image so the gateway and the pre-pull DaemonSet can pin the exact layers:
- `gateway.yaml` carries `COMPUTE_IMAGE_TAG` and `COMPUTE_IMAGE_DIGEST` env vars `devops/argocd/core/gateway.yaml:244-255` (both are populated today). The gateway consumes them in `cloud/gateway/src/lib/compute.ts:58-73`: when `COMPUTE_IMAGE_DIGEST` is set (bare `sha256:…`) and not in local-dev, the pod image becomes `${ACR_REGISTRY}/compute@<digest>` with `imagePullPolicy: IfNotPresent`; unset ⇒ `compute:latest` + `Always`.
- `compute-prepull.yaml` is a DaemonSet pinned by digest (`compute@sha256:…`) that runs `sleep infinity` only on nodes labelled `lmthing.cloud/pool=user`, warming containerd's image cache so a user's first pod on a fresh pool node skips the cold pull `devops/argocd/core/compute-prepull.yaml:14-49`. With no such pool node in the cluster today, its `nodeSelector` matches zero nodes — a no-op until the pool exists `devops/argocd/core/compute-prepull.yaml:11-13,28-29,44-46`. CI overwrites the digest line in lockstep with `COMPUTE_IMAGE_DIGEST` `.github/workflows/build-images.yml:435-449`.

The compute image build context is the `sdk/org` submodule root — the Dockerfile itself documents this requirement `devops/argocd/compute/Dockerfile:1-4`.

## ArgoCD GitOps sync

Two ArgoCD `Application`s in the `argocd` namespace watch this repo (`main`) and reconcile the cluster:

| Application | Path watched | Target namespace(s) | Sync policy |
|---|---|---|---|
| `lmthing-core` | `devops/argocd/core` | `lmthing` | automated `prune: true`, `selfHeal: true`; `CreateNamespace=true`, `ServerSideApply=true` |
| `lmthing-envoy` | `devops/argocd/envoy` | `gateway` | automated `prune: true`, `selfHeal: true`; `ServerSideApply=true`; retry limit 3, backoff 10s×2 → 1m |

(`devops/argocd/apps/core.yaml:8-32`, `devops/argocd/apps/envoy.yaml:8-27`). Both carry the `resources-finalizer.argocd.argoproj.io` finalizer `devops/argocd/apps/core.yaml:6-7`. `lmthing-core` also `ignoreDifferences` on the `postgres` StatefulSet's volumeClaimTemplate fields that K8s mutates server-side `devops/argocd/apps/core.yaml:23-32`.

`devops/argocd/core/kustomization.yaml` lists what `lmthing-core` applies: namespace, postgres, zitadel, litellm, render, gateway, computer, compute-pod-template, compute-prepull, studio, chat, and the eight product SPAs (`com`, `social`, `store`, `org`, `space`, `team`, `blog`, `casa`) `devops/argocd/core/kustomization.yaml:4-23`.

**Bootstrapping** the Applications is a one-time Ansible step (`argocd_apps` role): copies `apps/core.yaml` + `apps/envoy.yaml` to the node and applies them `devops/ansible/roles/argocd_apps/tasks/main.yml:5-22`, then waits until `lmthing-core` reports `.status.sync.status == "Synced"` (30×10s) and rolls out litellm, gateway, computer `devops/ansible/roles/argocd_apps/tasks/main.yml:24-45`.

### Sync latency & forcing a sync

ArgoCD here is **poll-only** — no git webhook — so a freshly-pushed commit can take up to ~3 min (the default comparison-cache TTL) to reconcile (see [devops/CLAUDE.md](../../../devops/CLAUDE.md) gotchas and `.issues/argocd-no-webhook-sync-latency.md`). To force immediately:

```bash
# Hard refresh (invalidate comparison cache) — from a control-plane node
kubectl -n argocd annotate application lmthing-core \
  argocd.argoproj.io/refresh=hard --overwrite

# Or trigger a sync via the Ansible Makefile (patches the Application's operation)
cd devops/ansible && make argocd-sync APP=lmthing-core
```

`make argocd-sync APP=<name>` merges an `operation.sync` (with `prune`) into the named Application `devops/ansible/Makefile:84-86`; `make argocd-apps` lists Application sync status `devops/ansible/Makefile:80-82`.

**Gotchas that bite deploys** (from [devops/CLAUDE.md](../../../devops/CLAUDE.md)):
- A **ConfigMap change does not roll pods** — e.g. after editing `litellm.yaml`'s model list, run `kubectl rollout restart deploy/litellm -n lmthing`; ArgoCD syncs the ConfigMap but K8s won't restart mounted-ConfigMap consumers.
- An **out-of-bounds symlink anywhere in the repo** breaks ALL core/envoy syncs with `ComparisonError: repository contains out-of-bounds symlinks` — check the Application's `status.conditions`.
- **Secrets are NOT in ArgoCD** — they come from the `cloud_secrets` Ansible role (`make deploy-secrets`); ArgoCD ignores secret changes in git.

## Deploying an SPA

For an existing SPA the deploy is fully automatic: push a source change to `main`, `build-images.yml` detects it, builds+pushes `lmthingacr.azurecr.io/<app>:<sha>`, commits the tag into `devops/argocd/core/<app>.yaml`, and ArgoCD rolls it out.

Studio/computer/chat share the unified image (`sdk/org/apps/web/Dockerfile`, context `.`) but are three separate `Deployment`+`Service` pairs (distinct domains, different Envoy routing) — `devops/argocd/core/chat.yaml` is the pattern: `Deployment` (nginx, port 80, `imagePullSecrets: [acr-pull-secret]`) + `Service` `devops/argocd/core/chat.yaml:1-42`. The other SPAs (`com`/`social`/`store`/`org`/`space`/`team`/`blog`/`casa`) each have their own `<app>/Dockerfile` + `<app>/nginx.conf`.

### Adding a new static SPA

Per the deploy-spa skill, the full checklist:
1. Create `<app>/Dockerfile` (copy `com/Dockerfile`, adjust dist path) and `<app>/nginx.conf` (copy `com/nginx.conf`).
2. Create `devops/argocd/core/<app>.yaml` (copy `com.yaml`, rename `com` → `<app>`), and add `- <app>.yaml` to `devops/argocd/core/kustomization.yaml`.
3. Add HTTP + HTTPS listeners for `lmthing.<tld>` to `devops/argocd/envoy/cloud-gateway.yaml`.
4. Add a `Certificate` for `lmthing.<tld>` to `devops/argocd/envoy/tls-certificates.yaml`.
5. Add HTTP-redirect + HTTPS static routes to `devops/argocd/envoy/spa-routes.yaml`.
6. Add a path filter + build-matrix entry to `.github/workflows/build-images.yml` — the push `paths` list `.github/workflows/build-images.yml:10-35`, the `filters` block `.github/workflows/build-images.yml:57-132`, the matching `<APP>: ${{ steps.changes.outputs.<app> }}` env var `.github/workflows/build-images.yml:140-155`, and the `all_images` list `.github/workflows/build-images.yml:168-182`. (`org` — the docs SPA — is the most recent example of all four edits.)
7. Point the DNS A record for `lmthing.<tld>` → the Azure VM IP `4.223.83.5`.

(Envoy routing detail — Gateways, HTTPRoutes, JWT/Lua `/api/*` policies, cross-namespace ReferenceGrant — is in [./infrastructure.md](./infrastructure.md).)

## Domain health checks

`.etc/scripts/check-domains.sh` walks the lmthing.\* domains and checks, per domain, **DNS** A records, **TLS** cert SANs (via `openssl s_client`), and **HTTPS** response codes (200 = deployed, 404 = not yet, 000 = TLS/timeout failure) `.etc/scripts/check-domains.sh:59-109`. For `lmthing.computer` it additionally asserts the WebContainer cross-origin isolation headers (`Cross-Origin-Embedder-Policy` credentialless/require-corp, `Cross-Origin-Opener-Policy` same-origin) `.etc/scripts/check-domains.sh:164-177`, and for `lmthing.cloud` it probes `/api/auth/me` and `/v1/models` expecting `401` unauthenticated `.etc/scripts/check-domains.sh:27-30,189-199`. Requires `dig`, `curl`, `openssl`, `gh` `.etc/scripts/check-domains.sh:51-56`. Exit code = error count `.etc/scripts/check-domains.sh:213`.

**The script is stale — do not trust its hosting model.** It still lists seven SPAs (`studio`, `chat`, `com`, `store`, `team`, `social`, `space`) as GitHub Pages sites, expects their DNS to point at the four GitHub Pages IPs, queries `gh api repos/<repo>/pages`, and fails when `.github/workflows/dispatch-<app>.yml` is missing `.etc/scripts/check-domains.sh:7-19,111-151`. None of that holds: the only workflows in the repo are `build-images.yml`, `deploy-ghpages.yml`, `design-tokens.yml`, `pr-decline.yml`, `stale.yml` (no `dispatch-*.yml`), and every one of those SPAs is a K8s Deployment pulling an ACR image (`devops/argocd/core/{studio,chat,com,store,team,social,space}.yaml`, listed in `devops/argocd/core/kustomization.yaml:4-23`) fronted by Envoy, not Pages — so every Pages/dispatch assertion in the script is guaranteed to fail against the current deployment. It also comments that VM-hosted domains are "served via K3s" `.etc/scripts/check-domains.sh:21`, which is wrong: the cluster is Kubespray-provisioned (see [./infrastructure.md](./infrastructure.md)). What *is* still current: the VM IP `4.223.83.5` `.etc/scripts/check-domains.sh:8` (same host as the SSH target in the root CLAUDE.md) and the DNS/TLS/HTTPS + COEP/COOP + `/api/*` 401 checks. Only the ghpages/dispatch/K3s parts are out of date.

For a quick post-deploy check from the cluster, the Ansible Makefile also exposes `make status` (pods in `lmthing`/`gateway`/`argocd`), `make routes` (Gateways/HTTPRoutes/Certificates), and `make logs-gateway|logs-litellm|logs-argocd` `devops/ansible/Makefile:60-78`.

## Common kubectl operations

From the root CLAUDE.md and the ansible Makefile. SSH to the control plane first (`ssh -i …/lmthing-test-key.pem azureuser@4.223.83.5`):

```bash
# All deployments, all namespaces
kubectl get deployments --all-namespaces -o wide

# Roll a core deployment (e.g. after a ConfigMap-only change to litellm)
kubectl rollout restart deployment/litellm -n lmthing
kubectl rollout restart deployment/gateway -n lmthing

# Tail logs
kubectl logs -n lmthing deployment/gateway -f

# ArgoCD: list apps / force a hard refresh
kubectl get applications -n argocd
kubectl -n argocd annotate application lmthing-core argocd.argoproj.io/refresh=hard --overwrite

# Roll a rebuilt compute:latest to an existing user (PVC /data persists):
# delete the user's Deployment; next /api/compute/ensure recreates it
kubectl delete deployment/lmthing -n user-<id>

# Blunt fallback: restart ALL user compute pods
kubectl get namespaces | grep ^user- | awk '{print $1}' \
  | xargs -I{} kubectl rollout restart deployment/lmthing -n {}
```

The gateway's own readiness probe hits `/api/health` on port 3000 `devops/argocd/core/gateway.yaml:263-268` — a healthy gateway pod is the deploy's liveness signal.

## See also

- [./infrastructure.md](./infrastructure.md) — Terraform / Kubespray / Envoy / ArgoCD install, namespaces, routing, secrets
- [./local-dev.md](./local-dev.md) — running the stack locally
- [../cloud/README.md](../cloud/README.md) — the gateway/LiteLLM backend that these images run
- [../cli-api/README.md](../cli-api/README.md) — the compute-pod CLI server the `compute` image runs
- [devops/CLAUDE.md](../../../devops/CLAUDE.md) — full DevOps guide (gotchas, scaling, vault)
