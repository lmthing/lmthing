---
name: deploy-spa
description: Load when deploying an SPA (GitHub Pages / K8s), adding a new deployment, or running domain health checks.
---

# Deploying SPA Services

## Overview

All frontend SPAs are deployed to the **Azure VM** via Kubernetes (ArgoCD GitOps).

**Studio, Computer, and Chat** are all served from a single unified Docker image (`lmthingacr.azurecr.io/{studio,computer,chat}`) built from `sdk/org/packages/ui/apps/web/Dockerfile` — same Dockerfile, separate K8s Deployments + Services because they serve distinct domains with different Envoy routing (studio/computer have JWT+Lua /api/* routing; chat/studio/computer all proxy /api/* to the user's compute pod).

All other SPAs (`com`, `social`, `store`, `space`, `team`, `blog`, `casa`) each have their own `{app}/Dockerfile` and `{app}/nginx.conf`.

## K8s Resources (per SPA)

- `devops/argocd/core/{app}.yaml` — K8s Deployment + Service in `lmthing` namespace
- `devops/argocd/envoy/` — HTTPRoutes + SecurityPolicies per domain:
  - Studio/Computer/Chat: `{app}-routes.yaml` + `{app}-policies.yaml` (JWT auth + Lua routing for `/api/*`)
  - Others: `spa-routes.yaml` (HTTP redirect + HTTPS static routes)
- `devops/argocd/envoy/cloud-gateway.yaml` — Gateway listeners per domain (HTTP + HTTPS)
- `devops/argocd/envoy/tls-certificates.yaml` — cert-manager Certificate per domain

## How It Works

1. Push to `main` triggers `.github/workflows/build-images.yml`
2. `dorny/paths-filter` detects which app source changed
3. Docker image built and pushed to ACR as `lmthingacr.azurecr.io/{app}:<sha>`
4. CI commits updated image tag to `devops/argocd/core/{app}.yaml`
5. ArgoCD auto-syncs the manifest change → K8s rolls out the new image

**DNS:** All SPA domains point A record → `135.116.57.95` (Azure VM).

## Deployed SPAs

| App | Domain | ACR Image | Dockerfile | Envoy routing |
|-----|--------|-----------|------------|---------------|
| studio | lmthing.studio | `lmthingacr.azurecr.io/studio` | `sdk/org/packages/ui/apps/web/Dockerfile` | JWT+Lua /api/* → compute pod |
| computer | lmthing.computer | `lmthingacr.azurecr.io/computer` | `sdk/org/packages/ui/apps/web/Dockerfile` | JWT+Lua /api/* → compute pod |
| chat | lmthing.chat | `lmthingacr.azurecr.io/chat` | `sdk/org/packages/ui/apps/web/Dockerfile` | JWT+Lua /api/* → compute pod |
| com | lmthing.com | `lmthingacr.azurecr.io/com` | `com/Dockerfile` | static only |
| social | lmthing.social | `lmthingacr.azurecr.io/social` | `social/Dockerfile` | static only |
| store | lmthing.store | `lmthingacr.azurecr.io/store` | `store/Dockerfile` | static only |
| space | lmthing.space | `lmthingacr.azurecr.io/space` | `space/Dockerfile` | static only |
| team | lmthing.team | `lmthingacr.azurecr.io/team` | `team/Dockerfile` | static only |
| blog | lmthing.blog | `lmthingacr.azurecr.io/blog` | `blog/Dockerfile` | static only |
| casa | lmthing.casa | `lmthingacr.azurecr.io/casa` | `casa/Dockerfile` | static only |

## Adding a New Static SPA

1. Create `{app}/Dockerfile` — copy from `com/Dockerfile`, adjust dist path
2. Create `{app}/nginx.conf` — copy from `com/nginx.conf`
3. Create `devops/argocd/core/{app}.yaml` — copy from `com.yaml`, replace all `com` → `{app}`
4. Add `- {app}.yaml` to `devops/argocd/core/kustomization.yaml`
5. Add HTTP + HTTPS listeners for `lmthing.{tld}` to `devops/argocd/envoy/cloud-gateway.yaml`
6. Add a Certificate for `lmthing.{tld}` to `devops/argocd/envoy/tls-certificates.yaml`
7. Add HTTP redirect + HTTPS static routes to `devops/argocd/envoy/spa-routes.yaml`
8. Add path filter + build matrix entry to `.github/workflows/build-images.yml`
9. Point DNS A record for `lmthing.{tld}` → `135.116.57.95`

## Domain Health Check

Run `.etc/scripts/check-domains.sh` to verify all lmthing.\* domains are correctly configured. It checks:

- **DNS** — A records point to Azure VM (`135.116.57.95`)
- **TLS** — Let's Encrypt certificate is provisioned for the domain
- **HTTPS** — site responds (200 = deployed, 404 = not yet deployed)
