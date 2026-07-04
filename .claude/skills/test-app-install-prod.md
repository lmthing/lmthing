# Skill: Test the app-install flow on prod with a test user

End-to-end runbook for exercising **project-as-application install + the app's
AI-assisted functionality** against the live cluster, using a disposable **test
user**. Covers: picking/preparing a test user, freeing CPU when the node is
saturated, seeding a browser session, driving the `store → install → app` flow,
and fanning the AI functional tests out across **Sonnet subagents** with the
chrome-devtools MCP.

> Single-user app model: an installed project-app is for its owner only — there
> is no per-app auth. The app surface (`lmthing.app`) authenticates the user the
> same way `studio`/`chat` do (a gateway JWT); everything under `/app/<id>/`
> then runs in that user's own compute pod. On `localhost` the pod needs no auth
> at all. See `sdk/org/project-as-application.md`.

## When to use

- Verifying a compute-image change that touches install / pages-build / the
  project-app runtime reached prod and actually works in a real pod.
- Reproducing an install bug a user reported (e.g. `POST /api/apps/install` 404).
- Smoke-testing a newly published catalog app (blog/health/kitchen/trips/…).

## Prerequisites

- SSH to the K8s node (all `kubectl` runs **through SSH** — the node holds the
  kubeconfig):
  ```bash
  ssh -i ~/GEANT/lmthing/devops/terraform/generated/lmthing-test-key.pem \
      -o StrictHostKeyChecking=no azureuser@4.223.83.5 '<kubectl …>'
  ```
- The **chrome-devtools MCP** (drives the browser for the UI flow).
- No API keys needed locally — the pod already has `lmthingcloud` creds injected
  by the gateway (`user-env` secret) for the AI features.

Throughout, `TEST=user-379847043318834826` is the chosen test-user namespace and
`UID=379847043318834826` its user id (the `user-<UID>` suffix). Pick any real
`user-*` namespace as the test user — you mint your own session for it.

---

## Step 1 — Pick a test user; free CPU if the node is saturated

Each compute pod **requests** CPU (250m–1000m per tier). Actual usage is tiny,
but the scheduler packs on *requests*: once the node's requests approach
allocatable, new pods (and rolling updates) go `Pending` with
`FailedScheduling … Insufficient cpu`. Check:

```bash
kubectl top nodes                                   # actual usage (usually low)
kubectl describe node node1 | grep -A2 "Allocated resources" | grep cpu
# e.g. cpu 3260m (95%) of 3400m allocatable  → saturated on requests
```

If saturated, **scale every user pod except the test user to 0** (authorized for
test cycles — these are dev/test tenants):

```bash
for ns in $(kubectl get ns -o name | grep -oE 'user-[0-9]+'); do
  [ "$ns" = "$TEST" ] && continue
  kubectl scale deploy lmthing -n "$ns" --replicas=0
done
kubectl get pods -A | grep -E '^user-'               # only $TEST should remain 1/1
```

Remember these namespaces — **Step 8** scales them back up.

## Step 2 — Ensure the test pod runs the latest compute image

The install endpoint and the project-app runtime live in `compute:latest`. A pod
started before a fix still runs the **old** image (`imagePullPolicy: Always`
only re-pulls on pod (re)start). Restart + wait:

```bash
kubectl rollout restart deploy/lmthing -n $TEST
kubectl rollout status  deploy/lmthing -n $TEST --timeout=180s
kubectl get pod -n $TEST -l app=compute \
  -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'; echo
```

Confirm the Phase-10 endpoints are live **in the pod** (no auth needed inside the
cluster — curl the pod IP directly):

```bash
POD_IP=$(kubectl get pod -n $TEST -l app=compute -o jsonpath='{.items[0].status.podIP}')
curl -s -m 20 http://$POD_IP:8080/api/apps | head -c 300; echo   # → {"apps":[{"id":"blog",…
```

`GET /api/apps` returning the catalog (blog, demo-feed, health, kitchen, trips)
means the new code is running. A missing route / 404 here ⇒ still the old image.

## Step 3 — Mint a gateway JWT for the test user

The gateway issues **HS256** JWTs signed with `GATEWAY_JWT_SECRET` (base64, in
the `lmthing-secrets` secret). Payload: `{ sub: <UID>, email, iat, exp }`
(`cloud/gateway/src/lib/tokens.ts`). Mint one **on the node**, printing **only
the token** (never the secret) — pure `node:crypto`, no `jose` needed:

```bash
ssh -i ~/GEANT/lmthing/devops/terraform/generated/lmthing-test-key.pem \
    -o StrictHostKeyChecking=no azureuser@4.223.83.5 '
UID=379847043318834826
SECRET_B64=$(kubectl get secret lmthing-secrets -n lmthing -o jsonpath="{.data.GATEWAY_JWT_SECRET}" | base64 -d)
SECRET_B64="$SECRET_B64" UID="$UID" node -e "
  const c=require(\"crypto\");
  const key=Buffer.from(process.env.SECRET_B64,\"base64\");
  const b=(o)=>Buffer.from(JSON.stringify(o)).toString(\"base64url\");
  const now=Math.floor(Date.now()/1000);
  const sign=(p)=>{const h=b({alg:\"HS256\",typ:\"JWT\"})+\".\"+b(p);
    return h+\".\"+c.createHmac(\"sha256\",key).update(h).digest(\"base64url\");};
  const uid=process.env.UID;
  console.log(JSON.stringify({
    access:  sign({email:\"test@lmthing.cloud\",sub:uid,iat:now,exp:now+43200}),
    refresh: sign({type:\"refresh\",sub:uid,iat:now,exp:now+2592000}),
    exp: (now+43200)*1000, uid
  }));
"'
```

`GATEWAY_JWT_SECRET` reads a prod secret — if the auto classifier blocks it,
run the SSH line yourself with `! <cmd>` and paste back the JSON (only a
short-lived test token, not the secret). Keep the JSON — Step 4 injects it.

## Step 4 — Seed the browser session and drive the UI flow

The SPA reads its session from `localStorage.lmthing_session`. Inject the minted
token on **both** origins (the store links you to the app), then reload. With
chrome-devtools MCP:

1. `new_page` → `https://lmthing.store`
2. `evaluate_script` to seed the session (use the JSON from Step 3):
   ```js
   const s = { accessToken: ACCESS, refreshToken: REFRESH, expiresAt: EXP,
     userId: UID, email: 'test@lmthing.cloud', githubRepo: null, githubUsername: null };
   localStorage.setItem('lmthing_session', JSON.stringify(s));
   ```
3. Navigate to `https://lmthing.app` and seed the **same** session there, reload
   → you should land on the `/apps` launcher (logged in), **not** the sign-in
   screen. (If it shows sign-in, the `?code` OAuth path isn't involved here —
   the localStorage session is authoritative; confirm the key name + JSON shape.)
4. The real user flow: on `lmthing.store` click **Install** on an app (e.g.
   `blog`) → you're redirected to `https://lmthing.app/install?appId=blog` →
   the page calls `POST /api/apps/install {appId}` in your pod → on success the
   app appears in the `/apps` launcher → open it at `/app/blog/`.

`take_snapshot` / `take_screenshot` at each step to verify.

## Step 5 — Verify install + pages build server-side

Cross-check what the browser did against the pod directly (fast, unambiguous):

```bash
# Install (idempotent; force:true overwrites local edits):
curl -s -m 120 -X POST -H 'content-type: application/json' \
  -d '{"appId":"blog"}' http://$POD_IP:8080/api/apps/install | head -c 900; echo
# Expect: {"ok":true,"projectId":"blog","installed":{tables,pages,endpoints,hooks},
#          "built":{"contracts":{"ok":true,…},"pages":{"ok":true,"built":true,…}}}
curl -s -m 20 http://$POD_IP:8080/api/projects | head -c 400; echo   # blog now listed
```

`built.pages.ok:false` with `Could not resolve "@app/runtime"` ⇒ the compute
image is missing `libs/cli/src/app/runtime` (see Troubleshooting). `built.pages.ok:true`
means the app UI will actually render at `/app/blog/`.

## Step 6 — Test the app's AI-assisted functionality

Project-apps ship an agent space (e.g. blog's `newsroom`/`editorial`) plus
`hooks/` that call models. **Two kinds of AI trigger — prefer on-demand for a
test:**

- **On-demand** — the page-droppable `<Chat agent="space/agent" />` widget
  (blog `/app/blog/discover` → `editorial/curator`; also trips/health/kitchen).
  Type a message, watch the agent stream a reply. This is the fastest AI proof
  and what the Sonnet subagents drive (Step 7).
- **Cron / event hooks** — e.g. blog's `refresh-sources` is a **cron** hook
  (`every: '30m'`, agent `newsroom/fetcher`) that fills `raw_items`, which fires
  the `synthesize-new` on-insert hook to produce `articles`. Adding a source does
  **not** trigger it immediately — the feed populates on the next 30-min tick.
  Don't wait on this in a smoke test; drive the `<Chat>` path instead.

Instrument either way:

- Watch `list_network_requests` for `/v1/*` (LiteLLM) calls succeeding (200, not
  429 budget / 401). A 429 ⇒ the test user's budget window is exhausted — pick a
  fresher test user or wait for the window to roll (free tier: $3/1d, $20/7d).
- Confirm the DB updated via the app's own API, e.g.
  `curl http://$POD_IP:8080/app/<id>/api/<list-endpoint>` (project-app APIs mount
  at `/app/:projectId/api/*`).

## Step 7 — Fan AI functional tests out across Sonnet subagents

To cover several apps/features at once, spawn one **Sonnet** subagent per app
(`Agent` tool, `subagent_type: general-purpose`, `model: sonnet`). The
chrome-devtools MCP drives **one shared browser**, so give each subagent its own
tab and a disjoint app so they don't fight over the foreground:

- Each subagent: `new_page` → `https://lmthing.app` → seed the **same** session
  (pass it the Step-3 JSON in the prompt) → install its assigned app via the UI
  (or `POST /api/apps/install`) → open `/app/<id>/` → exercise that app's AI
  feature → report back {installed?, pages rendered?, AI call 200?, DB updated?}.
- Give each a **distinct app** (blog / health / kitchen / trips) and tell it to
  operate only on its own tab (`select_page` by index) — the browser is shared
  state, so overlapping navigation on one tab corrupts another's run.
- Keep the orchestrator lean: collect each subagent's verdict, don't re-drive the
  browser yourself. (Partition-by-app mirrors the "fan-out Sonnet by directory"
  preference.)

## Step 8 — Cleanup

Scale the other users back up (they auto-pull `compute:latest` on start):

```bash
for ns in <the namespaces you scaled in Step 1>; do
  kubectl scale deploy lmthing -n "$ns" --replicas=1
done
```

Leave the test user's installed apps in place (harmless) or delete the project
dir in the pod if you want a clean slate for the next run.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `POST /api/apps/install` → **404** in the browser, but the pod curl works | Old compute image in that user's pod (endpoint added later) | Step 2 rollout restart; verify `imageID` + `GET /api/apps` |
| Install → `catalog entry "<id>" is missing project.json` | App-builder apps ship only `package.json` | Fixed: install synthesizes a deterministic `project.json` from the manifest (`sdk/org` `f313ba1`). Rebuild+rollout the compute image. |
| `built.pages.ok:false … Could not resolve "@app/runtime"` | Compute image shipped `dist/` only; pages build aliases `@app/runtime` → `<cliRoot>/src/app/runtime` | Fixed: Dockerfile ships `libs/cli/src/app/runtime` (monorepo `789086f`). Rebuild+rollout. |
| `built.pages.ok:false … Could not resolve "@lmthing/auth"`/`@lmthing/css/…` | A `<Chat>`-using page (blog/discover, trips, health, kitchen) pulls `@lmthing/ui/chat`, whose closure needs auth/css/state — libs the image didn't ship | Fixed: Dockerfile ships `libs/{auth,css,state,utils}` (monorepo `d77b123`). Rebuild+rollout. Regression-tested by pages.test.ts "builds a page that imports `<Chat>`". |
| First install in the browser → **504** after ~15s | Envoy route timeout < the download+boot+build time | Install is idempotent — retry; the second call (already downloaded) returns fast. Longer-term: raise the app route timeout. |
| `/v1/*` calls **429** during AI test | Test user's budget window exhausted | Use a fresher test user or wait for the 1d window to roll. |
| `lmthing.app` shows sign-in despite a seeded session | Wrong `localStorage` key/shape, or session on the wrong origin | Key is `lmthing_session`; seed it on `lmthing.app` itself; shape per Step 4. |

## Related

- `sdk/org/project-as-application.md` — the app model (single-user, no app auth).
- `sdk/org/libs/cli/src/server/routes/apps.ts` — `GET /api/apps`, `POST /api/apps/install`.
- `store/scripts/gen-apps-manifest.mjs` — emits `/projects/manifest.json` + per-app `files`.
- `.claude/skills/cloud-backend.md`, `reference-prod-test-user-and-deploy` memory.
