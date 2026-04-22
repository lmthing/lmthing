# Deploying SPA Services

## Overview

All frontend SPAs are deployed to the **Azure VM** via Kubernetes (ArgoCD GitOps). Each SPA has:

- `{app}/Dockerfile` — multi-stage build (node:22-slim builder + nginx:alpine runtime)
- `{app}/nginx.conf` — nginx config with SPA fallback; chat also includes COEP/COOP headers
- `devops/argocd/core/{app}.yaml` — K8s Deployment + Service in `lmthing` namespace
- `devops/argocd/envoy/spa-routes.yaml` — HTTPRoutes (HTTP redirect + HTTPS SPA) for all SPAs
- `devops/argocd/envoy/cloud-gateway.yaml` — Gateway listeners per domain (HTTP + HTTPS)
- `devops/argocd/envoy/tls-certificates.yaml` — cert-manager Certificate per domain

## How It Works

1. Push to `main` triggers `.github/workflows/build-images.yml`
2. `dorny/paths-filter` detects which app source changed
3. Docker image built from `{app}/Dockerfile` (build context: repo root), pushed to ACR as `lmthingacr.azurecr.io/{app}:<sha>`
4. CI commits updated image tag to `devops/argocd/core/{app}.yaml`
5. ArgoCD auto-syncs the manifest change → K8s rolls out the new image

**DNS:** All SPA domains point A record → `135.116.57.95` (Azure VM).

## Deployed SPAs

| App | Domain | ACR Image | nginx headers |
|-----|--------|-----------|---------------|
| studio | lmthing.studio | `lmthingacr.azurecr.io/studio` | standard |
| chat | lmthing.chat | `lmthingacr.azurecr.io/chat` | COEP/COOP |
| com | lmthing.com | `lmthingacr.azurecr.io/com` | standard |
| social | lmthing.social | `lmthingacr.azurecr.io/social` | standard |
| store | lmthing.store | `lmthingacr.azurecr.io/store` | standard |
| space | lmthing.space | `lmthingacr.azurecr.io/space` | standard |
| team | lmthing.team | `lmthingacr.azurecr.io/team` | standard |
| blog | lmthing.blog | `lmthingacr.azurecr.io/blog` | standard |
| casa | lmthing.casa | `lmthingacr.azurecr.io/casa` | standard |
| computer | lmthing.computer | `lmthingacr.azurecr.io/computer` | COEP/COOP |

## Adding a New SPA

1. Create `{app}/Dockerfile` — copy from `studio/Dockerfile`, change filter name and dist path
2. Create `{app}/nginx.conf` — copy from `studio/nginx.conf` (or `chat/nginx.conf` if COEP needed)
3. Create `devops/argocd/core/{app}.yaml` — copy from `studio.yaml`, change all `studio` → `{app}`
4. Add `- {app}.yaml` to `devops/argocd/core/kustomization.yaml`
5. Add HTTP + HTTPS listeners for `lmthing.{tld}` to `devops/argocd/envoy/cloud-gateway.yaml`
6. Add a Certificate for `lmthing.{tld}` to `devops/argocd/envoy/tls-certificates.yaml`
7. Add HTTP redirect + HTTPS static routes to `devops/argocd/envoy/spa-routes.yaml`
8. Add path filters + build/push step + updated `git add` to `.github/workflows/build-images.yml`
9. Point DNS A record for `lmthing.{tld}` → `135.116.57.95`

## Domain Health Check

Run `.etc/scripts/check-domains.sh` to verify all lmthing.\* domains are correctly configured. It checks:

- **DNS** — A records point to Azure VM (`135.116.57.95`)
- **TLS** — Let's Encrypt certificate is provisioned for the domain
- **HTTPS** — site responds (200 = deployed, 404 = not yet deployed)
