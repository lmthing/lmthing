# Deploying SPA Services

## Overview

Most frontend apps are static SPAs deployed to **GitHub Pages** via separate repos. Each SPA gets its own GitHub repo (e.g., `lmthing/studio`, `lmthing/chat`, `lmthing/com`) that exists solely to host a GitHub Pages site. The repo contains only a `.github/workflows/deploy.yml` — no source code.

**Exception:** `lmthing.computer` is served from the **Azure VM** (K3s) instead of GitHub Pages, because it requires `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers for WebContainer support (SharedArrayBuffer). See [VM-hosted SPAs](#vm-hosted-spas-lmthingcomputer) below.

## How It Works

1. Push to `main` in the monorepo triggers a **dispatch workflow** (e.g., `.github/workflows/dispatch-studio.yml`)
2. The dispatch workflow fires a `repository_dispatch` event to the target repo (e.g., `lmthing/studio`)
3. The target repo's `deploy.yml` checks out the **monorepo**, builds the specific app, and deploys to its own GitHub Pages

**SPA fallback (404.html):** GitHub Pages doesn't natively support client-side routing. By copying `index.html` to `404.html`, GitHub Pages serves the app shell on any route, and TanStack Router handles the path.

## Existing Workflow Files

**Monorepo dispatch workflows** (`.github/workflows/`):

| File | Target Repo |
|------|-------------|
| `dispatch-studio.yml` | `lmthing/studio` |
| `dispatch-chat.yml` | `lmthing/chat` |
| `dispatch-com.yml` | `lmthing/com` |
| `dispatch-store.yml` | `lmthing/store` |
| `dispatch-team.yml` | `lmthing/team` |
| `dispatch-social.yml` | `lmthing/social` |
| `dispatch-space.yml` | `lmthing/space` |
| `dispatch-computer.yml` | ~~`lmthing/computer`~~ (deprecated — computer is now VM-hosted) |

## Adding a New SPA Deployment

To deploy a new app (e.g., `blog` at lmthing.blog):

### Step 1: Create the target repo

Create `lmthing/blog` on GitHub (empty, with Pages enabled).

### Step 2: Add deploy workflow to the target repo

Create `.github/workflows/deploy.yml` in the target repo:

```yaml
name: Deploy to lmthing.blog

on:
  repository_dispatch:
    types: [deploy-blog]
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          repository: lmthing/lmthing
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up pnpm via Corepack
        run: |
          corepack enable
          corepack prepare pnpm@10.17.1 --activate

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build blog
        run: pnpm --filter @lmthing/blog build

      - name: SPA fallback
        run: cp blog/dist/index.html blog/dist/404.html

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: blog/dist

  deploy:
    name: Deploy
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to lmthing.blog
        id: deployment
        uses: actions/deploy-pages@v4
```

If the app needs build-time env vars (like com needs `VITE_STRIPE_PUBLISHABLE_KEY`), add them to the build step via `env:` and configure them as repo secrets.

### Step 3: Add dispatch workflow to the monorepo

Create `.github/workflows/dispatch-blog.yml`:

```yaml
name: Trigger blog deploy

on:
  push:
    branches:
      - main

jobs:
  dispatch:
    name: Dispatch to lmthing/blog
    runs-on: ubuntu-latest
    steps:
      - name: Trigger deploy
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.DISPATCH_TOKEN }}
          repository: lmthing/blog
          event-type: deploy-blog
```

### Step 4: Configure the target repo

- Enable GitHub Pages (Settings > Pages > Source: GitHub Actions)
- Add custom domain `lmthing.blog` (Settings > Pages > Custom domain)
- Add `DISPATCH_TOKEN` as a monorepo secret if not already present (a PAT with `repo` scope)

## VM-hosted SPAs (lmthing.computer)

Some SPAs need custom HTTP headers that GitHub Pages can't provide. These are served from the Azure VM via nginx in K3s.

**Why:** `lmthing.computer` uses WebContainer, which requires `SharedArrayBuffer`. Browsers gate this behind cross-origin isolation (`Cross-Origin-Embedder-Policy: credentialless` + `Cross-Origin-Opener-Policy: same-origin`). GitHub Pages cannot set custom response headers.

**Architecture:** `computer/Dockerfile` (nginx:alpine) + `computer/nginx.conf` (headers + SPA fallback) → K8s deployment (`cloud/k8s/computer.yaml`) → Traefik IngressRoute (`computer-ingress` in `cloud/k8s/ingress.yaml.tpl`) → Let's Encrypt TLS.

**DNS:** `lmthing.computer` A record → `135.116.57.95` (Azure VM), NOT GitHub Pages IPs.

### Deploy computer to VM

```bash
# 1. Build locally
pnpm --filter @lmthing/computer build

# 2. Sync to VM
rsync -avz -e "ssh -i ~/LMTHING/litellm_key.pem" \
  computer/dist/ computer/nginx.conf computer/Dockerfile \
  azureuser@135.116.57.95:~/computer/

# 3. Build image + restart on VM
ssh -i ~/LMTHING/litellm_key.pem azureuser@135.116.57.95 \
  "cd ~/computer && sudo docker build -t lmthing/computer:latest . && \
   sudo docker save lmthing/computer:latest | sudo k3s ctr images import - && \
   sudo k3s kubectl -n lmthing rollout restart deployment/computer"
```

### Moving another SPA to the VM

1. Create `{app}/Dockerfile` and `{app}/nginx.conf` (copy from `computer/`)
2. Create `cloud/k8s/{app}.yaml` deployment + service (copy from `computer.yaml`)
3. Add an IngressRoute in `cloud/k8s/ingress.yaml.tpl` for `Host(\`lmthing.{tld}\`)`
4. Add the resource to `cloud/k8s/kustomization.yaml`
5. Point DNS A record to `135.116.57.95`

## Domain Health Check

Run `.etc/scripts/check-domains.sh` to verify all lmthing.\* domains are correctly configured. It checks:

- **DNS** — A records point to GitHub Pages IPs (185.199.{108-111}.153) or Azure VM (`135.116.57.95` for VM-hosted SPAs)
- **TLS** — Let's Encrypt certificate is provisioned for the domain
- **HTTPS** — site responds (200 = deployed, 404 = not yet deployed)
- **GitHub Pages config** — custom domain set, build source is Actions workflow, HTTPS enforcement enabled (GH Pages SPAs only)
- **Dispatch workflow** — `dispatch-{app}.yml` exists in the monorepo (GH Pages SPAs only)
