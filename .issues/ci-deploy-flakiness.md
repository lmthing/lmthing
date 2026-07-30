# CI/CD deploy flakiness — fixes in, awaiting a first real run

Three papercuts in `.github/workflows/build-images.yml`. **All three are now fixed in the
workflow**; this file survives only because the fixes cannot be proven without a real `main` push,
and CI is the one gate that has no offline equivalent. Delete it after the first hands-off deploy
that lands tags and syncs without manual help.

What was wrong and what changed:

1. **`update-manifests` lost a git push race** — fixed with a 5-attempt `git pull --rebase && git
   push` loop with backoff. The `concurrency` group above the jobs was NOT the fix and never could
   be: it serializes `build-images` runs against each other, while the race is against the
   status/build-data automation pushing to `main` from a *different* workflow, outside the group.
   The push was rejected AFTER images were in ACR, so a re-run was needed to land tags for
   artifacts that already existed.

2. **The ArgoCD sync POSTed to an Application that does not exist** — `…/applications/lmthing/sync`,
   404, swallowed by `|| true`. Confirmed against the cluster: the Applications are `lmthing-core`
   and `lmthing-envoy`. So the explicit sync had never once fired, and deploys landed only because
   `lmthing-core` has automated selfHeal and reconciled on its own poll — which is exactly the
   latency filed in [argocd-no-webhook-sync-latency.md](./argocd-no-webhook-sync-latency.md). Now
   syncs both apps, still tolerant of failure (a sync that cannot fire must not fail a run whose
   images are published) but a failure is `::warning::`-reported instead of silent.

3. **Submodule-pointer-only commits did not trigger a build** — already fixed before this pass:
   `sdk/org` (no `/**`) is in the `paths:` filter and in every per-image `changed()` list.

## Verified so far

Offline only: the YAML parses, and every `run:` block in `update-manifests` passes `bash -n`. The
ArgoCD app names are confirmed live (`kubectl get applications -n argocd`). What is NOT verified is
the retry actually winning a real race, and the sync returning 2xx with the real
`ARGOCD_SERVER_URL`/`ARGOCD_AUTH_TOKEN` — both need a genuine run, and triggering one deploys to
production, so it waits for the next real change rather than a probe.

## Still open (separate concern, not a workflow bug)

User compute pods run `compute:latest` with `imagePullPolicy: Always`, but a *running* pod does not
re-pull on a new build — `kubectl rollout restart deployment/lmthing -n user-<id>` is required. The
user-facing path is the chat app's "New version available / Upgrade" interstitial, driven by the
gateway's advertised `COMPUTE_IMAGE_TAG`.
