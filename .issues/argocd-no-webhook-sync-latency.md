# ArgoCD doesn't sync freshly-pushed commits — no git webhook, poll-only

Observed 2026-07-01 while deploying the 4-tier LLM-provider change. After
`git push` landed the feature commit + CI's image-tag bumps on `main`, the
`lmthing-core` Application kept reporting an **older** synced revision and the
gateway/litellm pods never rolled. A manual force-refresh was required:

```bash
kubectl -n argocd annotate application lmthing-core \
  argocd.argoproj.io/refresh=hard --overwrite
```

Only after that did the app advance to the new revision and roll the Deployments.

## Root cause — ArgoCD is polling-only with a 3-minute comparison cache

There is **no git webhook** configured. `argocd-cm` has only:

```
timeout.reconciliation: 60s
timeout.hard.reconciliation: 0s
```

and **no `webhook.github.secret`** (or any `webhook.*`) key. So ArgoCD never
receives push events from GitHub — it discovers new commits purely by polling.

The controller logs show two kinds of reconciliation:

- `comparison-level=0/1` — frequent, lightweight; they **reuse the cached git
  revision** (`auto_sync_ms=0`, `sync_ms=0`, no real git fetch).
- `comparison-level=2` — the only pass that **re-queries the git repo**
  (`git_ms≈1000`). It runs when the per-app comparison cache **expires**
  (`expiry: 3m0s`) or on a **manual refresh**.

Log line at the moment of the manual annotation:

```
"Refreshing app status (comparison expired, requesting refresh.
 reconciledAt: 2026-07-01 10:13:11 +0000 UTC, expiry: 3m0s), level (2)"
... comparison-level=2 ... git_ms=1009   ← first fetch of the new revision
```

So a just-pushed commit is **not** picked up until the next level-2 refresh
(up to ~3 min later). Checking within that window shows the app "stuck" on the
previous revision, which is why the force-refresh looked necessary. It wasn't
broken — it was inside its detection-latency window, and there is no webhook to
collapse that window to ~instant.

## Secondary gap — ConfigMap changes don't roll pods

Even once ArgoCD synced, `litellm` kept running the old config: the change was to
the `litellm-config` **ConfigMap**, and a mounted-ConfigMap change does **not**
restart the consuming pods. A `kubectl rollout restart deploy/litellm -n lmthing`
was needed (and the pinned `main-latest` image with `imagePullPolicy: IfNotPresent`
had additionally gone stale — see the litellm-version pin commit).

## Fixes

1. **Add a GitHub push webhook → ArgoCD** for near-instant sync:
   - Set `webhook.github.secret` in `argocd-cm` (Ansible `cloud_secrets`/argocd role).
   - Add a repo webhook to `POST https://<argocd>/api/webhook` (json, push events).
   - This removes the up-to-3-min poll latency entirely.
2. **(Optional) shorten the poll latency** meanwhile via a lower comparison
   expiry, or keep the CI "Trigger ArgoCD sync" step but fix its app name — it
   currently POSTs to `.../applications/lmthing/sync` (404) instead of
   `lmthing-core`/`lmthing-envoy`. See `ci-deploy-flakiness.md` §2.
3. **Auto-restart on ConfigMap change** — add a config-hash annotation to the
   `litellm` pod template (e.g. a checksum of the ConfigMap) so a config edit
   rolls the Deployment, instead of relying on a manual `rollout restart`.

## Workaround (until fixed)

```bash
# force ArgoCD to fetch + sync the latest commit immediately
kubectl -n argocd annotate application lmthing-core argocd.argoproj.io/refresh=hard --overwrite
# if only a ConfigMap changed, also roll the consumer
kubectl rollout restart deploy/litellm -n lmthing
```
