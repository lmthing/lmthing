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

Ten workflows live in [.github/workflows/](../../../.github/workflows), in four contiguous groups:
the deploy pipeline (1), repo-wide hard gates (2), the **client** targets (5) — mobile and desktop,
which are not deployed at all but downloaded — and repo hygiene (2):

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Build and Push Images | `build-images.yml` | push to `main` (source paths, incl. `gh-pages/**`) + `workflow_dispatch` | Build changed Docker images, push to ACR, commit new tags, trigger sync, **and deploy the status page** |
| Design tokens | `design-tokens.yml` | PR + push to `main` (frontend paths) | Hard gate: fail on raw colors / non-token styling |
| Docs citations | `docs-sync.yml` | PR + push to `main` `.github/workflows/docs-sync.yml:8-39` | Hard gate: every `org/docs/` citation must resolve |
| Native target | `native-target.yml` | PR + push to `main` (`sdk/org` pointer) `.github/workflows/native-target.yml:18-51` | Hard gate: the React Native module graph resolves, transforms and mounts (Metro, no simulator) |
| Android APK | `mobile-android.yml` | push to `main` (`sdk/org` pointer) + `workflow_dispatch` `.github/workflows/mobile-android.yml:52-60` | **Per-commit installable APK** — prebuild + Gradle, published to the rolling `nightly` release |
| Desktop target | `desktop.yml` | PR + push to `main` (`sdk/org` pointer) `.github/workflows/desktop.yml:18-27` | Gate (typecheck / lint / clippy / E2E) **plus**, on pushes only, a Linux bundle published to `nightly` |
| Desktop release | `desktop-release.yml` | tag `desktop-v*` + `workflow_dispatch` `.github/workflows/desktop-release.yml:32-40` | All four platforms, drafts a GitHub release |
| Publish OTA update | `ota-publish.yml` | push to `main`/`staging` (`sdk/org` pointer) + `workflow_dispatch` `.github/workflows/ota-publish.yml:56-92` | Ships a JavaScript-only update to installed mobile binaries |
| PR manual decline | `pr-decline.yml` | PR labeled + `workflow_dispatch` | Canned-message close of PRs by maintainer label |
| Close stale threads | `stale.yml` | daily cron `0 9 * * *` | Mark/close inactive issues |

**Every client-side workflow triggers on the bare `sdk/org` submodule POINTER, and that is the only
path entry that can fire** — the mobile and desktop apps live inside the submodule, which no commit
in this repository ever touches. A submodule update changes exactly one gitlink entry, at `sdk/org`.
Naming paths inside it matches nothing; `native-target.yml` shipped with exactly that bug and ran
once in its life `.github/workflows/native-target.yml:20-33`.

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
| team | `sdk/org/apps/web/Dockerfile` | `.` | `devops/argocd/core/team.yaml` |
| com/social/store/org/space/blog/casa | `<app>/Dockerfile` | `.` | `devops/argocd/core/<app>.yaml` |

(from the `all_images` list `.github/workflows/build-images.yml:168-182` — 13 images: gateway, computer, compute, studio, chat and the eight product SPAs, `org` included). Studio, computer, chat and team share one Dockerfile (`sdk/org/apps/web/Dockerfile`) and one build context (repo root `.`) — the same unified SPA image, deployed as four Deployments for four domains. (`team` used to have its own scaffold SPA; that directory is gone and lmthing.team is now a surface of the unified app.)

**2. `build`** — matrix job over the detected images (`fail-fast: false`) `.github/workflows/build-images.yml:191-200`:
- Azure login (`AZURE_CREDENTIALS` secret) → `az acr login --name lmthingacr` `.github/workflows/build-images.yml:211-217`.
- `docker/build-push-action@v5` pushes **two tags** per image — `:<sha>` and `:latest` — with a registry-backed build cache (`buildcache` ref, `mode=max`) `.github/workflows/build-images.yml:219-230`.
- Records build metadata (image, sha, `sha256:` digest, run id/number/url, conclusion, timestamp) to `build-data/<image>.json` and uploads it as artifact `build-data-<image>` `.github/workflows/build-images.yml:232-277`.

**3. `publish-pages`** (`needs: [detect, build]`) — builds the status page and deploys it to GitHub Pages as an **artifact**. Nothing is committed `.github/workflows/build-images.yml:311-332`. It runs when any image was built **or** when the page's own source changed (`pages_changed`), because it is the only thing that deploys the site and a `gh-pages/**` edit builds no images at all `.github/workflows/build-images.yml:312-316`.

- **Assemble** `.github/workflows/build-images.yml:341-431`: since nothing is committed, **the published site is the only durable copy of the rolling history**. The job reads `history.json` back from `https://lmthing.github.io/lmthing`, prepends this run's records (deduped by SHA, capped at 50), and carries over the per-image record of every image that did *not* rebuild — otherwise a rarely-built image would vanish from the site.
- **A 404 on `history.json` is fatal, not "first publish"** `.github/workflows/build-images.yml:400-419`. Pages answers 404 for a misconfigured or broken site too, so inferring "start fresh" would republish a one-entry history and destroy the real one — and the next run would build on the truncated copy. Bootstrapping is opt-in via the `allow_empty_history` dispatch input `.github/workflows/build-images.yml:10-14`. A 404 on a *per-image* file is ordinary (that image has never been built) and is skipped.
- **Upload + deploy** via `actions/upload-pages-artifact` + `actions/deploy-pages`, under concurrency group `pages` `.github/workflows/build-images.yml:433-440`.

> **Why not commit the data?** The previous design committed it to `main` and relied on that push to fire a separate `deploy-ghpages.yml`. It cannot: the commit carries `[skip ci]`, **and** GitHub does not start workflow runs from pushes made with `GITHUB_TOKEN`. The page silently went un-deployed for three weeks while `history.json` in the repo stayed current. Publishing an artifact removes the commit, the `[skip ci]`, the second workflow, and the rebase-onto-`main` race in one go. `gh-pages/data/builds/*.json` is therefore **gitignored** — the repo holds only the page source.

**4. `update-manifests`** (`needs: [detect, build]`) — now the **only** job that pushes to `main`, so it no longer serializes behind the page job and runs in parallel with it `.github/workflows/build-images.yml:442-452`. It:
- Re-downloads the build-data artifacts and only rewrites manifests for images whose artifact records `conclusion == 'success'` — a failed image (e.g. compute) is skipped so its stale tag stays put `.github/workflows/build-images.yml:557-483`.
- For each built image, regex-replaces `image: lmthingacr.azurecr.io/<img>:<old>` with the new SHA in that image's manifest `.github/workflows/build-images.yml:484-491`.
- **Compute is special**: when `compute` is rebuilt it also patches `COMPUTE_IMAGE_TAG` (and, when a digest was captured, `COMPUTE_IMAGE_DIGEST`) in `devops/argocd/core/gateway.yaml`, and pins the `compute-prepull` DaemonSet image by digest in `devops/argocd/core/compute-prepull.yaml` `.github/workflows/build-images.yml:492-536`.
- Commits the `devops/argocd/core/` changes to `main` with message `ci: update image tags to <sha> [skip ci]`, then `git pull --rebase` + `git push` `.github/workflows/build-images.yml:540-549`. This job commits *before* rebasing, which is safe here only because it stages regex-substituted manifests rather than editing them after the pull.
- Finally, a best-effort ArgoCD sync `POST $ARGOCD_SERVER_URL/api/v1/applications/lmthing/sync` guarded by an empty-URL short-circuit and `|| true` `.github/workflows/build-images.yml:551-560`.

**The sync-trigger step is dead code — reconciliation actually happens via ArgoCD's polling loop.** The curl POSTs to `/api/v1/applications/lmthing/sync`, i.e. an Application named `lmthing` `.github/workflows/build-images.yml:557`, but no such Application exists: the repo defines exactly two, `lmthing-core` `devops/argocd/apps/core.yaml:2-4` and `lmthing-envoy` `devops/argocd/apps/envoy.yaml:2-4` (they are the only `kind: Application` manifests in the tree), and the Ansible bootstrap applies only those two `devops/ansible/roles/argocd_apps/tasks/main.yml:5-22`. So against a cluster provisioned by this repo the POST would 404 — and both `[ -z "$ARGOCD_SERVER_URL" ] && exit 0` and the trailing `|| true` swallow the failure `.github/workflows/build-images.yml:551-560`. Net effect: the deploy always waits on ArgoCD's poll (see [Sync latency](#sync-latency--forcing-a-sync) below), which is exactly the symptom recorded in `.issues/argocd-no-webhook-sync-latency.md`. (A correct URL would be `/api/v1/applications/lmthing-core/sync`.)

### `design-tokens.yml` — the styling hard gate

On PRs and pushes to `main` touching frontend paths (`sdk/org/**`, `com/**`, `social/**`, `team/**`, `store/**`, `space/**`, `blog/**`, `casa/**`), runs `node sdk/org/libs/css/scripts/lint-design-tokens.mjs` over the SPA and shared-lib source trees (`sdk/org/libs/{css,ui}/src`, `sdk/org/apps/web/src`, and each SPA's `src/`); a raw color (hex / literal `rgb()`/`hsl()` / stock Tailwind color utility) fails the build `.github/workflows/design-tokens.yml:6-43`. Note the newest SPA, `org/`, is **not** yet in either the trigger paths or the lint argument list `.github/workflows/design-tokens.yml:9-16,20-27,40-43` — it is currently ungated. Rules & escape hatches: [../design-system/README.md](../design-system/README.md).

### Client binaries — what CI builds on every commit

Neither of these is a release. Both exist to answer, per commit, "does the native app still build,
and can I run the thing that came out?" — a question no other gate reaches: `native-target.yml`
proves the Metro graph resolves, `ota-publish.yml` exports a JS bundle, and `desktop.yml`'s `rust`
job compiles the crate, but none of them runs Gradle or produces a package.

**`mobile-android.yml` → an installable APK.** `sdk/org/apps/mobile/android/` is gitignored
`sdk/org/apps/mobile/.gitignore:8-9` — it is prebuild *output*, not source — so CI generates the
native project first (`expo prebuild --platform android --no-install`, which defaults to a clean
generation) and then runs `./gradlew :app:assembleRelease`
`.github/workflows/mobile-android.yml:123-137`. Workspace dependencies are built by invoking the
app's own `eas-build-post-install` hook verbatim, so this path and an EAS build cannot drift
`.github/workflows/mobile-android.yml:115-117`.

Three things make the artifact unmistakably *not* a release candidate:

- **Debug-signed.** `expo prebuild` generates `release { signingConfig signingConfigs.debug }`, and
  no release keystore exists in this org. Play rejects the upload; a phone installs it fine.
- **arm64-v8a only** `.github/workflows/mobile-android.yml:135-137`. `newArchEnabled=true` means
  React Native compiles its C++ from source and `gradle.properties` asks for four ABIs, so the
  default is that compile done four times for a throwaway artifact. The cost: it will **not** install
  on the standard x86_64 emulator. (Measured: ~4m for the single-ABI release build.)
- **versionCode 1, always** — `eas.json` sets `appVersionSource: "remote"`
  `sdk/org/apps/mobile/eas.json:2-5`, so the real number is allocated by EAS and a plain Gradle
  build never asks.

It also cannot receive an OTA update: no `EXPO_OTA_APP_ID` is set, and without that header the
server answers "No app id provided" forever `sdk/org/apps/mobile/app.config.js:115-119`. Note that
`RELEASE_CHANNEL` is *also* unset and defaults to `production`
`sdk/org/apps/mobile/app.config.js:110-114`, so the binary does ask for the production channel —
which is inert, because omitting `EXPO_OTA_APP_ID` puts the build on a different `runtimeVersion`
entirely `sdk/org/apps/mobile/app.config.js:138-145`, one no publish targets. The job prints the
APK's embedded fingerprint to the run summary `.github/workflows/mobile-android.yml:142-146`; that
value, read out of the artifact rather than re-resolved later, is what an entry in
`sdk/org/apps/mobile/shipped-runtime-versions.json` needs.

**`desktop.yml` → a Linux AppImage + .deb.** The `bundle` job is skipped on pull requests
`.github/workflows/desktop.yml:148-152` and runs on `ubuntu-22.04`, not `ubuntu-latest`, for the
same reason `desktop-release.yml` does: AppImage and .deb are forward-compatible only, and a binary
linked against a newer glibc fails at exec time with a bare `version 'GLIBC_2.39' not found`. It is
Linux-only on purpose — macOS runners bill at 10x minutes and Windows at 2x, so a full per-commit
matrix would cost roughly 25x this job to catch, on the platforms that break least often, what the
tag build catches anyway. All four targets remain on `desktop-release.yml`.

#### Where the binaries land — the rolling `nightly` release

Both jobs publish to **one shared prerelease tagged `nightly`**, in addition to uploading a
per-commit workflow artifact `.github/workflows/desktop.yml:222-229`
`.github/workflows/mobile-android.yml:166-171`. The two serve different purposes and both are
wanted: the artifact's name carries the SHA and is the provenance trail, while the release always
holds only the newest build, at a fixed public URL:

```
https://github.com/lmthing/lmthing/releases/download/nightly/lmthing-linux-x86_64.AppImage
https://github.com/lmthing/lmthing/releases/download/nightly/lmthing-linux-amd64.deb
https://github.com/lmthing/lmthing/releases/download/nightly/lmthing-android-arm64.apk
```

A workflow artifact cannot serve that purpose: it 404s for anyone not signed in to GitHub, expires
after 14 days, and downloads only as a zip — which a phone cannot install. Asset names are
deliberately **version-free**, because Tauri encodes the version into its own filenames
(`lmthing_0.1.0_amd64.AppImage`) and publishing those as-is would break every link already handed
out the moment `version` in `tauri.conf.json` changes `.github/workflows/desktop.yml:242-247`.

**Two jobs writing one release is a race, and the design avoids it rather than sequencing it.**
Creation is idempotent — `gh release view` short-circuits the common case and `|| true` covers the
window where the other job created it in between `.github/workflows/desktop.yml:262-268`. Provenance
then travels *with* each asset as a sibling `BUILD-INFO-linux.txt` / `BUILD-INFO-android.txt`
rather than in the release body `.github/workflows/desktop.yml:249-258`: distinct filenames cannot
collide, whereas two jobs rewriting one body would silently lose whichever write landed first. The
Android file records the APK's embedded `runtimeVersion`
`.github/workflows/mobile-android.yml:193-202`.

The notes are re-rendered from a committed template on every run
`.github/workflows/nightly-release-notes.md:1-27`, because `--notes-file` is read only at
*creation* — without that an edit to the template would never reach the live release. Running it
unconditionally is safe precisely because both jobs render the same committed file, so concurrent
writes agree instead of clobbering `.github/workflows/desktop.yml:270-273`.

Consequences worth knowing: the assets are replaced **independently**, so the desktop and Android
downloads are not guaranteed to come from the same commit (check the `BUILD-INFO` beside each). And
the `nightly` git tag stays at whichever commit first created the release — it is a container, not
a version marker; the assets are what move.

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

`devops/argocd/core/kustomization.yaml` lists what `lmthing-core` applies: namespace, postgres, zitadel, litellm, render, ota, gateway, computer, compute-pod-template, compute-prepull, studio, chat, and the eight product SPAs (`com`, `social`, `store`, `org`, `space`, `team`, `blog`, `casa`) `devops/argocd/core/kustomization.yaml:4-24`. `ota` is the expo-open-ota server behind `lmthing.cloud/ota` that serves the mobile app's over-the-air updates; its secrets come from the `cloud_secrets` role like every other secret, not from ArgoCD.

It is reached by **two** routes on the same host, and both are load-bearing. `/ota/*` is prefix-stripped to the server (`devops/argocd/envoy/cloud-routes.yaml:149-179`) and exists because `https://lmthing.cloud/ota/manifest` is compiled into every shipped binary. `/assets` and `/<app-uuid>/*` are served at the host ROOT with no rewrite (`devops/argocd/envoy/cloud-routes.yaml:202-229`), because the publishing CLI resolves the server's address as the *origin* of that manifest URL and discards the path — so its `requestUploadUrl`, `markUpdateAsUploaded`, `rollback`, `republish` and `uploadLocalFile` calls are all addressed to the root. `BASE_URL` is correspondingly the bare origin (`devops/argocd/core/ota.yaml:57-70`), which is also what makes the upload URL the server returns match what the CLI expects. Changing either one alone breaks publishing silently: the root has no default backend, so the CLI receives a bodiless 404.

> A new HTTPRoute that writes `DOMAIN_PLACEHOLDER` must also be named in the `replacements` list in `devops/argocd/envoy/kustomization.yaml:37-77`. The list is opt-in — an unlisted route ships the literal placeholder and the API server rejects it against the hostname pattern.

> **Removing a key from a secret task does not remove it from the cluster.** The
> `cloud_secrets` role applies each Secret with `state: present`, which merges — so a
> key deleted from `stringData` stays in the live object indefinitely, holding whatever
> value it last had. Deleting one for real needs an explicit
> `kubectl patch secret <name> -n lmthing --type=json -p '[{"op":"remove","path":"/data/<KEY>"}]'`.
> This matters when the value being retired is a credential: the point of removing it is
> that it stops existing, and a merge quietly defeats that.

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

Studio/computer/chat share the unified image (`sdk/org/apps/web/Dockerfile`, context `.`) but are three separate `Deployment`+`Service` pairs (distinct domains, different Envoy routing) — `devops/argocd/core/chat.yaml` is the pattern: `Deployment` (nginx, port 80, `imagePullSecrets: [acr-pull-secret]`) + `Service` `devops/argocd/core/chat.yaml:1-42`. The other SPAs (`com`/`social`/`store`/`org`/`space`/`blog`/`casa`) each have their own `<app>/Dockerfile` + `<app>/nginx.conf`.

### Adding a new static SPA

Per the deploy-spa skill, the full checklist:
1. Create `<app>/Dockerfile` (copy `com/Dockerfile`, adjust dist path) and `<app>/nginx.conf` (copy `com/nginx.conf`).
2. Create `devops/argocd/core/<app>.yaml` (copy `com.yaml`, rename `com` → `<app>`), and add `- <app>.yaml` to `devops/argocd/core/kustomization.yaml`.
3. Add HTTP + HTTPS listeners for `lmthing.<tld>` to `devops/argocd/envoy/cloud-gateway.yaml`.
4. Add a `Certificate` for `lmthing.<tld>` to `devops/argocd/envoy/tls-certificates.yaml`.
5. Add HTTP-redirect + HTTPS static routes to `devops/argocd/envoy/spa-routes.yaml`. (A domain that also proxies `/api` into a compute pod gets its own `<app>-routes.yaml` + `<app>-policies.yaml` pair instead, registered in `devops/argocd/envoy/kustomization.yaml:5-22` — `team-routes.yaml`/`team-policies.yaml` are the most recent example.)
6. Add a path filter + build-matrix entry to `.github/workflows/build-images.yml` — the push `paths` list `.github/workflows/build-images.yml:10-35`, the `filters` block `.github/workflows/build-images.yml:57-132`, the matching `<APP>: ${{ steps.changes.outputs.<app> }}` env var `.github/workflows/build-images.yml:140-155`, and the `all_images` list `.github/workflows/build-images.yml:168-182`. (`org` — the docs SPA — is the most recent example of all four edits.)
7. Point the DNS A record for `lmthing.<tld>` → the Azure VM IP `4.223.83.5`.

(Envoy routing detail — Gateways, HTTPRoutes, JWT/Lua `/api/*` policies, cross-namespace ReferenceGrant — is in [./infrastructure.md](./infrastructure.md).)

## Domain health checks

`.etc/scripts/check-domains.sh` walks the lmthing.\* domains and checks, per domain, **DNS** A records, **TLS** cert SANs (via `openssl s_client`), and **HTTPS** response codes (200 = deployed, 404 = not yet, 000 = TLS/timeout failure) `.etc/scripts/check-domains.sh:59-109`. For `lmthing.computer` it additionally asserts the WebContainer cross-origin isolation headers (`Cross-Origin-Embedder-Policy` credentialless/require-corp, `Cross-Origin-Opener-Policy` same-origin) `.etc/scripts/check-domains.sh:164-177`, and for `lmthing.cloud` it probes `/api/auth/me` and `/v1/models` expecting `401` unauthenticated `.etc/scripts/check-domains.sh:27-30,189-199`. Requires `dig`, `curl`, `openssl`, `gh` `.etc/scripts/check-domains.sh:51-56`. Exit code = error count `.etc/scripts/check-domains.sh:213`.

**The hosting model it checks against:** *every* lmthing.\* domain — including `studio`, `chat`, `team`, `com`, `store`, `social` and `space` — is a K8s Deployment in the `lmthing` namespace pulling an ACR image (`devops/argocd/core/{studio,chat,com,store,team,social,space}.yaml`, listed in `devops/argocd/core/kustomization.yaml:4-23`), fronted by Envoy on the Kubespray cluster, and its DNS A record points at the single VM IP `4.223.83.5`. **No SPA is on GitHub Pages** and there are no `dispatch-<app>.yml` workflows (the repo's workflows are `build-images.yml`, `design-tokens.yml`, `pr-decline.yml`, `stale.yml`) — so any Pages-IP / `gh api repos/<repo>/pages` / dispatch-workflow assertion the script still makes (`.etc/scripts/check-domains.sh:7-19,111-151`) will fail against the live deployment regardless of cluster health. The DNS/TLS/HTTPS, COEP/COOP and `/api/*` 401 checks are the parts worth reading.

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
