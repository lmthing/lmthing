# Zero-day Auto-Update for LMThing Servers

## Context

Today, LMThing only rebuilds a server image when **application code** changes. If a
zero-day is disclosed in a base image (`node:24-slim`, `nginx:alpine`), an npm
dependency (`jose`, `hono`, `postgres`, `stripe`), the third-party LiteLLM image, or
the Ubuntu node OS, the running servers stay vulnerable until a human notices and
pushes a dummy commit. There is currently **no** detection (no Trivy, no Dependabot,
no Renovate), no scheduled rebuild, and no node-OS patching.

The good news: **rollout is already fully automated.** Once a new image/tag reaches
the ArgoCD manifests on `main`, ArgoCD auto-syncs (`prune: true`, `selfHeal: true`)
and the gateway/SPAs/LiteLLM roll out within ~3 min. So the work is to **close the
loop upstream**: detect → bump/rebuild → open a PR → (human merges) → existing flow
deploys.

**User's binding decisions:**
- **Scope:** everything — backend (gateway + LiteLLM), all 9 SPA images, the per-user
  compute image, **and** Ubuntu node OS patching.
- **Gate:** **auto-PR, human merges.** Detection + rebuild are automatic, but a human
  must merge the PR that triggers deploy. Nothing in this plan auto-deploys.

## Strategy

Four detection/build layers + node-OS patching, all funneling through one human gate,
all reusing the existing ACR → manifest-commit → ArgoCD pipeline:

| Layer | What it does | Output |
|---|---|---|
| **1. Dependabot** | Bumps npm deps + Dockerfile `FROM` base images + GHA action versions | PRs (human merges) |
| **2. Scheduled rebuild** | Weekly cron rebuilds all images to refresh mutable base tags (`node:24-slim` etc.) | **Opens a PR** (not auto-commit) |
| **3. Trivy scanning** | Build-time gate (SARIF → Security tab) + **daily scan of deployed images** that opens an issue on new CRITICAL CVEs | Security tab + issues (the zero-day alarm) |
| **4. Node OS** | Azure auto-installs security patches with `reboot_setting = Never`; weekly workflow opens an issue listing available updates + runbook | Patches downloaded automatically; **human runs the reboot runbook** |

**Central invariant:** the existing `update-manifests` job in `build-images.yml`
auto-commits to `main` and force-syncs ArgoCD (`build-images.yml:369-389`). That path
is correct for *code* merges (a human already approved the PR) but **must never run on
a schedule** — it would bypass the human gate. Layer 2 lives in a **separate workflow**
that opens a PR instead, and we add a hard `github.event_name != 'schedule'` guard to
`update-manifests` so it can never fire from a schedule.

---

## Layer 1 — Dependabot (deps + base images)

**Create `.github/dependabot.yml`.** Representative config:

```yaml
version: 2
updates:
  # gateway has its OWN package-lock.json (npm), not part of pnpm workspace
  - package-ecosystem: "npm"
    directory: "/cloud/gateway"
    schedule: { interval: "weekly", day: "monday" }
    open-pull-requests-limit: 10
    commit-message: { prefix: "chore(deps)" }

  # pnpm workspace: root + every workspace package (Dependabot reads pnpm-lock.yaml)
  - package-ecosystem: "npm"
    directories: ["/", "/com", "/blog", "/casa", "/social", "/store",
                 "/space", "/team", "/sdk/org/apps/web",
                 "/sdk/org/libs/auth", "/sdk/org/libs/core", "/sdk/org/libs/cli",
                 "/sdk/org/libs/css", "/sdk/org/libs/state", "/sdk/org/libs/ui",
                 "/sdk/org/libs/utils"]
    schedule: { interval: "weekly", day: "monday" }
    commit-message: { prefix: "chore(deps)" }
    ignore:   # these are intentionally pinned to "latest" in pnpm-workspace catalog
      - dependency-name: "vite-plus"
      - dependency-name: "vite"
      - dependency-name: "vitest"

  # Docker base images — one entry per Dockerfile (node:24-slim, nginx:alpine)
  - { package-ecosystem: "docker", directory: "/cloud/gateway",         schedule: { interval: "weekly" } }
  - { package-ecosystem: "docker", directory: "/sdk/org/apps/web",      schedule: { interval: "weekly" } }
  - { package-ecosystem: "docker", directory: "/devops/argocd/compute", schedule: { interval: "weekly" } }
  - { package-ecosystem: "docker", directory: "/com",   schedule: { interval: "weekly" } }
  # ...repeat /blog /casa /social /store /space /team

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
    commit-message: { prefix: "chore(ci)" }
```

**Decisions / pitfalls:**
- **Mixed pnpm/npm is real:** `cloud/gateway/` uses npm (`package-lock.json` v3) and is **not** in `pnpm-workspace.yaml`; everything else shares the root `pnpm-lock.yaml`. Hence the standalone `/cloud/gateway` npm entry.
- **Auto-merge stays OFF** (no `auto-merge:` block; do not enable the repo "Allow auto-merge" setting). This is what enforces the human gate.
- **Security advisories fire immediately** regardless of the weekly schedule (Dependabot default) — these are the front-line dep zero-day PRs.
- **`vite-plus`/`vite`/`vitest` `latest` pins** (verify in `pnpm-workspace.yaml` catalog during impl) must be in `ignore:` or Dependabot spams endless PRs.
- **Alternative:** Renovate (`renovate.json` + app) if you later want grouped/deduplicated updates — same human-merge gate.

---

## Layer 2 — Scheduled rebuild that opens a PR (the crux)

**Create `.github/workflows/rebuild-images.yml`** (cron + `workflow_dispatch`).
**Modify `.github/workflows/build-images.yml`**: add the schedule guard.

### Design
- Trigger: weekly cron (e.g. `0 6 * * 1` Mon 06:00 UTC) + manual `workflow_dispatch` (with an `images` input, like the existing one, and a `base_branch` input for safe testing).
- **Reuse the existing build matrix and build step** — preferred via a callable workflow: extract the `detect` + `build` jobs of `build-images.yml` into `.github/workflows/_build.yml` (`on: [workflow_call]`), then both `build-images.yml` and `rebuild-images.yml` `uses:` it. Single source of truth, no matrix drift. *(Fallback if the team wants minimal churn on the working pipeline: duplicate the matrix Python block into `rebuild-images.yml`.)*
- Build job is identical to today (`docker/build-push-action@v5`, tag `<sha>`+`:latest`, push to ACR). Because `node:24-slim`/`nginx:alpine` are mutable tags, `docker build` re-pulls the latest base layer and picks up OS-CVE fixes automatically — this is the rebuild.

### The fork — `open-rebuild-pr` job (replaces `update-manifests` for this path)
Reuse the **exact same regex** from `build-images.yml:328-367`, but commit to a branch + `gh pr create` instead of `main`:

```yaml
  open-rebuild-pr:
    needs: [detect, build]
    if: always() && needs.build.result == 'success'
    runs-on: ubuntu-latest
    permissions: { contents: write, pull-requests: write }
    steps:
      - uses: actions/checkout@v4
      - name: Bump manifest tags on a branch + open PR
        env: { GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}", SHA: "${{ needs.detect.outputs.sha }}" }
        run: |
          DATE=$(date -u +%Y-%m-%d); BRANCH="chore/scheduled-rebuild-${DATE}"
          git checkout -b "$BRANCH"
          python3 << 'EOF'   # verbatim regex from build-images.yml:328-367
          # for each (image, manifest): re.sub(r'(image: lmthingacr\.azurecr\.io/<img>:)\S+', '<sha>')
          # if image == compute: also bump COMPUTE_IMAGE_TAG in devops/argocd/core/gateway.yaml
          # NEW: also bump a rollout-restart annotation on litellm.yaml (see LiteLLM below)
          EOF
          git add devops/argocd/core/
          git commit -m "chore: scheduled security rebuild ${DATE} (${SHA})"
          git push --set-upstream origin "$BRANCH"
          gh pr create --base "$BASE_BRANCH" --head "$BRANCH" \
            --title "chore: scheduled security rebuild ${DATE}" \
            --body-file pr-body.md --label "security-rebuild"
```
`pr-body.md` includes the **Trivy before/after diff** from Layer 3.

### Hard guard on the existing auto-commit
Add to `update-manifests` in `build-images.yml` (`build-images.yml:305`):
```yaml
    if: always() && github.event_name != 'schedule' && needs.detect.outputs.matrix != '[]' && ...
```
This makes the auto-deploy path structurally incapable of firing from a schedule.

### Compute-pod angle (subtlety)
Per-user pods use `compute:latest` + `imagePullPolicy: Always` (`cloud/gateway/src/lib/compute.ts:54-147`), **not** the SHA. So:
- The rebuild pushes a new `compute:latest` to ACR.
- New user pods get it automatically; **existing** user pods only pick it up when the user triggers `POST /api/compute/upgrade` (or, per devops CLAUDE.md, the user's `lmthing` Deployment is deleted and `/api/compute/ensure` recreates it — `/data` PVC persists). The `COMPUTE_IMAGE_TAG` bump in `gateway.yaml` just updates the "upgrade available" banner.
- So merging the rebuild PR redeems gateway + SPAs immediately via ArgoCD, but compute is redeemed **lazily per user**. This is desirable (no mass rolling restart). Document it in the PR body.

### LiteLLM (gap to fold in)
LiteLLM (`devops/argocd/core/litellm.yaml`) uses third-party `ghcr.io/berriai/litellm:main-latest` with `imagePullPolicy: IfNotPresent`. We don't build it (so the rebuild doesn't naturally cover it), and `IfNotPresent` means it won't re-pull even on pod restart. To make Layer 2 cover LiteLLM: in the rebuild PR, **set `imagePullPolicy: Always` on litellm.yaml and bump a `kubectl.kubernetes.io/restartedAt`-style annotation** so merging the PR forces a re-pull of `main-latest`. Layer 3's daily scan detects LiteLLM CVEs; this is the redemption path.

---

## Layer 3 — Trivy (detection + gate + alarm)

### 3a. Build-time gate (modify `build-images.yml`, after the build step ~line 181)
```yaml
      - name: Trivy scan built image
        if: always() && success()
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: lmthingacr.azurecr.io/${{ matrix.image }}:${{ needs.detect.outputs.sha }}
          severity: CRITICAL,HIGH
          format: sarif
          output: trivy-${{ matrix.image }}.sarif
          exit-code: '0'   # start WARN-only; flip to '1' once tuned
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: trivy-${{ matrix.image }}.sarif }
```

### 3b. Daily scan of **deployed** images → opens an issue on new CRITICALs (the zero-day alarm)
**Create `.github/workflows/scan-deployed.yml`** (cron `0 8 * * *` + `workflow_dispatch`). Reads each deployed SHA from `devops/argocd/core/*.yaml` (same regex `status-data.yml` already uses), `az acr login`, scans that exact digest with Trivy, compares CRITICAL count against a baseline JSON committed to the `gh-pages` data dir, and **opens a GitHub issue** when new criticals appear — pointing the human at the rebuild workflow's `workflow_dispatch`. This is the detection signal that tells a human "merge a rebuild PR."

---

## Layer 4 — Node OS patching (Kubespray, currently single-node)

**Grounding:** `hosts.yml` has one node (`node1` = control-plane + etcd + worker). Rebooting it is a **controlled cluster outage** — it evicts every workload (gateway, LiteLLM, all user pods) and risks etcd. `main.tf:199-205` has no patch block. The GHA runner has no live cluster access.

**Recommendation (safe + human-gated): auto install, human reboot.**

### (b) Terraform — auto-install security patches, never auto-reboot
**Modify `devops/terraform/main.tf`** inside `resource "azurerm_linux_virtual_machine" "node"` (after line 204):
```hcl
  patch_assessment_mode = "AutomaticByPlatform"
  patch_mode            = "AutomaticByPlatform"
  automatic_by_platform_settings {
    reboot_setting = "Never"   # Azure installs security patches but NEVER reboots
  }
```
Patches download/install automatically (the "auto" part); the disruptive reboot waits for a human who drains first (the "human gate" part). Verify with `terraform plan` that the only diff is this block.

### (c) Detection + runbook
- **Create `devops/docs/node-patching-runbook.md`** — the human procedure: `kubectl drain` → `ansible node -b -m apt -a "upgrade=safe update_cache=yes"` → reboot → `kubectl uncordon`, with an explicit warning that on the current single-node topology this is a controlled outage (accept brief downtime, or wait until a worker node exists).
- **Create `.github/workflows/node-security-scan.yml`** — weekly cron. Checks available Ubuntu security updates across nodes and opens a `security,node-patch` issue with the list + runbook link. **Honest caveat:** the hosted runner can't reach nodes unless SSH is internet-reachable (it currently is — NSG `AllowSSH`, `ssh_allowed_ips` default open); storing the private key as a repo secret is real risk. Prefer a self-hosted runner in the VNet, or fall back to Azure VM patch-assessment via `az rest` (no SSH, lower fidelity). Start this workflow as `workflow_dispatch`-only until the access/secret story is settled.
- **Optional:** `devops/ansible/playbooks/node-patch.yml` + `make node-patch` — wraps the drain/apt/reboot/uncordon sequence; run by a human, never by CI.

**Tradeoff, stated:** node patching **cannot** be a pure PR+merge (the runner has no live cluster access, and GitOps can't drain/uncordon). On a single-node cluster the realistic outcome is that patches install quickly but reboots are rare, so kernel zero-days may remain exploitable until a human accepts the outage. The **proper** long-term fix is adding a worker node (`nodes.node2 = { role = "worker" }`) + PodDisruptionBudgets so rolling reboots become zero-downtime — call this out as a follow-up. (Switching to an Ubuntu Pro image would enable true no-reboot kernel hotpatching, but that's a licensing decision.)

---

## Implementation order

1. **Layer 1** — `.github/dependabot.yml`. Lowest risk, immediate security PRs.
2. **Layer 3a** — Trivy gate in `build-images.yml` (WARN-only + SARIF). Adds visibility before touching the manifest flow.
3. **Guard + extract `_build.yml`** reusable workflow; add `github.event_name != 'schedule'` guard to `update-manifests`.
4. **Layer 2** — `rebuild-images.yml` with the `open-rebuild-pr` job + LiteLLM rollout handling.
5. **Layer 3b** — `scan-deployed.yml` daily alarm (drives humans to Layer 2).
6. **Layer 4** — `terraform/main.tf` patch block + runbook + `node-security-scan.yml` (dispatch-only at first).

Layers 1, 3, 4 are independent and can proceed in parallel; Layer 2 depends on 3a (PR-body diff) and the guard.

## Critical files
- `.github/dependabot.yml` *(new)*
- `.github/workflows/build-images.yml` *(modify: Trivy gate + schedule guard; extract build to `_build.yml`)*
- `.github/workflows/rebuild-images.yml` *(new — opens a PR)*
- `.github/workflows/scan-deployed.yml` *(new — daily deployed-image alarm)*
- `.github/workflows/node-security-scan.yml` *(new — node patch detection)*
- `devops/terraform/main.tf` *(modify: `patch_mode` block, ~line 204)*
- `devops/docs/node-patching-runbook.md` *(new)*
- `devops/argocd/core/litellm.yaml` *(modify via rebuild PR: `imagePullPolicy: Always` + rollout annotation)*
- `cloud/gateway/src/lib/compute.ts` *(reference — compute `:latest` + Always-pull behavior; no change needed)*

## Verification (no prod touch)
- **Dependabot:** after merge, confirm PRs appear within ~24h under Insights → Dependency graph → Dependabot.
- **Trivy gate:** `workflow_dispatch` `build-images.yml` with `images: gateway` from a test branch; inspect SARIF in Security tab. Local: `trivy image lmthingacr.azurecr.io/gateway:<sha>`.
- **Rebuild PR:** `workflow_dispatch` `rebuild-images.yml` with `images: gateway` and `base_branch: <test-branch>`. Confirm PR opens against the test branch, manifest diff shows the new SHA, `COMPUTE_IMAGE_TAG` only changes when `compute` is in scope, LiteLLM rollout annotation present, Trivy diff renders. **Do not enable the Monday cron until observed end-to-end on a non-`main` base.**
- **Deployed scan:** `workflow_dispatch` `scan-deployed.yml`; verify it reads SHAs from manifests and writes the baseline; inject a fake CRITICAL to confirm the issue opens.
- **Node scan:** `workflow_dispatch` with a `dry_run` flag; confirm `apt list --upgradable` output is sane.
- **Terraform patch block:** `cd devops/terraform && terraform plan` — confirm the only diff is the added patch block; do not `apply` from CI.
