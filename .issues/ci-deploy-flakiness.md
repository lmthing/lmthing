# CI/CD deploy flakiness (build-images.yml + ArgoCD)

Three independent papercuts hit repeatedly while deploying this session
(`.github/workflows/build-images.yml`). All are recoverable by hand but should
be fixed for hands-off deploys.

## 1. `update-manifests` loses a git push race
The `update-manifests` job commits the image-tag bumps, `git pull --rebase`, then
`git push` — but the concurrent **`status-data`** / build-data automation pushes
to `main` in the same window, so the push is rejected (`! [rejected] … fetch
first`) and the job fails **after** images are already built+pushed to ACR.
Workaround used: `gh run rerun <id> --failed` (usually succeeds on retry).
Fix: push with a retry loop (`git pull --rebase && git push` up to N times), or
serialize the data-publishing workflows, or have them commit to a branch/orphan
ref instead of `main`.

## 2. ArgoCD sync curl targets the wrong app name
The "Trigger ArgoCD sync" step POSTs to `…/api/v1/applications/**lmthing**/sync`,
but the actual Argo app is **`lmthing-core`** (also `lmthing-envoy`). The call
404s and is swallowed by `|| true`, so the explicit sync never happens — deploys
only land because `lmthing-core` has `automated` (selfHeal) auto-sync, which
reconciles on its own poll interval. Manual force used:
`kubectl annotate app lmthing-core -n argocd argocd.argoproj.io/refresh=hard --overwrite`.
Fix: change the app name to `lmthing-core` (and/or sync both core + envoy).

## 3. Submodule-pointer-only commits don't trigger a build
The `paths:` filter lists `sdk/org/**`, which matches files *under* the submodule
but **not** a parent commit that only bumps the `sdk/org` gitlink (the changed
path is `sdk/org` itself). So a parent commit that only advances the submodule
pointer produces no `build-images` run. Workaround: `gh workflow run
build-images.yml --ref main` (workflow_dispatch builds the full matrix).
Fix: add `sdk/org` (no `/**`) to the paths filter, or detect submodule bumps.

## Bonus: user compute pods need a manual restart for new `compute:latest`
User pods run `compute:latest` (imagePullPolicy Always) but a *running* pod won't
re-pull on a new build — `kubectl rollout restart deployment/lmthing -n user-<id>`
is required. The chat app's "New version available / Upgrade" interstitial is the
user-facing path, driven by the gateway's advertised `COMPUTE_IMAGE_TAG`.
