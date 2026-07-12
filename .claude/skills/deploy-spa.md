---
name: deploy-spa
description: Load when deploying an SPA (GitHub Pages / K8s), adding a new deployment, or running domain health checks.
---

# Deploying SPA Services

Use this when you are shipping a frontend SPA (`studio`, `computer`, `chat`, `com`, `social`, `store`, `org`, `space`, `team`, `blog`, `casa`), adding a brand-new SPA + domain, or checking that a domain is live.

## Read first — the grounded truth

All knowledge about the pipeline lives in `org/docs/`. Do not re-derive it here:

- `org/docs/devops/deploy.md` — **the page that owns this skill.** CI workflows, the image/Dockerfile/manifest table, ACR tagging, ArgoCD sync (incl. sync latency and how to force one), the "adding a new static SPA" checklist, domain health checks, common kubectl ops.
- `org/docs/devops/infrastructure.md` — cluster, Envoy Gateway/HTTPRoutes/TLS, namespaces, per-user compute pods, the VM IP.
- `org/docs/devops/local-dev.md` — running the stack locally before you push.
- `devops/CLAUDE.md` — DevOps-area orientation and gotchas.

## Procedure — deploying an existing SPA

There is no manual deploy step. Push the source change to `main` and the pipeline does the rest (build → ACR → CI commits the new image tag into `devops/argocd/core/<app>.yaml` → ArgoCD reconciles).

```bash
# 1. Verify styling passes the hard gate before you push
pnpm lint:tokens

# 2. Push to main; watch the build
gh run watch

# 3. ArgoCD is poll-only (~3 min). To force reconcile, from a control-plane node:
kubectl -n argocd annotate application lmthing-core \
  argocd.argoproj.io/refresh=hard --overwrite
# or:  cd devops/ansible && make argocd-sync APP=lmthing-core

# 4. Confirm the rollout
kubectl get deployments -n lmthing -o wide
kubectl rollout status deployment/<app> -n lmthing
```

## Procedure — adding a new SPA

Follow the checklist in `org/docs/devops/deploy.md` ("Adding a new static SPA") — Dockerfile + nginx.conf, `devops/argocd/core/<app>.yaml` + kustomization entry, Gateway listeners, TLS Certificate, `spa-routes.yaml`, the four `build-images.yml` edits, DNS. The `org` SPA is the most recent worked example of every edit.

## Procedure — domain health check

```bash
.etc/scripts/check-domains.sh
```

Its DNS / TLS / HTTPS / COEP-COOP / `/api/*` 401 assertions are still useful. **Its GitHub-Pages, `dispatch-*.yml` and "K3s" assertions are stale and will always fail** — see the "Domain health checks" section of `org/docs/devops/deploy.md` before you act on its output.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the same change (see `org/docs/SYNC.md`).
