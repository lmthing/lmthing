---
name: web-search
description: Load when touching agent web search, the webSearch/webFetch functions, search providers (Tavily/Bing/DuckDuckGo), or the in-cluster headless-browser render service.
---

# Skill: Web Search (webSearch + the render service)

Agents search the web through **`webSearch()`**, a `system-global` function (so it's injected into
every agent/fork/delegate — see `@.claude/skills/system-spaces.md`). The research agents
(`system-research`) call it from their tasklist preludes; any tasklist opts in via a `functions:`
allowlist that names `webSearch`/`webFetch`.

`webSearch(query, opts)` returns `{ ok, query, answer, results: [{title,url,snippet,score}], error? }`.
`opts.provider` (default `'auto'`) selects the backend.

## Providers & the `auto` chain

`auto` tries providers in order and returns the **first that succeeds with results**:

1. **`tavily`** — keyed API (`TAVILY_API_KEY`). The only provider with an AI-synthesized `answer`.
   Authoritative when its call is `ok` — it can legitimately return an `answer` with **zero
   results**, so it is NOT gated on result count (gating it there breaks that case).
2. **`bing`** — renders `https://www.bing.com/search?...` **with JavaScript** via the in-cluster
   headless-browser **render service** (see below), then scrapes the rendered DOM. No key.
3. **`duckduckgo`** — plain `fetch` of the no-JS `html.duckduckgo.com` endpoint + regex scrape.
   No key, no render service. The always-available last resort.

So: `auto` → Tavily (if keyed) → Bing (if `RENDER_SERVICE_URL` set) → DuckDuckGo. Each stage falls
through on failure/empty, so a missing key, an unset render URL, or an empty Bing page degrades
gracefully.

**Why Bing, not Google** (important, empirically confirmed in prod): Google serves datacenter IPs a
consent/bot **redirect loop** (`200 → about:blank → re-nav with &sei=`) that never settles, so the
headless browser times out on every wait strategy — it's **IP-based, not JS-based**, so rendering
cannot fix it. Bing (and DuckDuckGo, example.com, …) render cleanly through the same service. If real
Google is ever required, use a SERP API / residential proxy, not the render service.

## The render service (self-hosted headless Chromium)

The compute pod's QuickJS sandbox has only `fetch` — no browser engine. To get a JS-rendered DOM,
`webSearchBing` (and `webFetch`'s dynamic-page fallback, see the file map) POSTs to an in-cluster
**browserless/chromium** service:

```
POST ${RENDER_SERVICE_URL}/content?token=${RENDER_SERVICE_TOKEN}
body: { url, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 15000 } }
→ returns the fully-rendered HTML as text
```

`waitUntil: 'domcontentloaded'` is deliberate — the default `load` hangs ~30s on a search page
waiting for trackers/beacons.

**Reachability & hardening** — the service is reachable **only from compute pods inside the cluster**:
- `type: ClusterIP` and **no Envoy HTTPRoute** → never externally reachable.
- A **NetworkPolicy** (`render-allow-compute`) default-denies ingress except namespaces labeled
  `lmthing.cloud/type: compute` (every gateway-created `user-<id>` namespace carries it; Calico
  enforces it — the first NetworkPolicy in the cluster).
- **Token auth**: `TOKEN` (from `lmthing-secrets` key `RENDER_SERVICE_TOKEN`) must be presented as
  `?token=` on every request. Fail-closed: the render pod won't start until the secret key exists.
- Probes are **tcpSocket**, not httpGet — browserless gates its HTTP routes when `TOKEN` is set, so a
  token-less kubelet httpGet probe would 401 and the pod would never go Ready.

The gateway injects `RENDER_SERVICE_URL` + `RENDER_SERVICE_TOKEN` into each pod's `user-env`
(authoritatively, in `injectLiteLLMEnv`) so `webSearchBing` reads them from `process.env`.

## File map

| File | Role |
|---|---|
| `sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts` | `webSearch` dispatch + `auto` chain; `webSearchTavily` / `webSearchBing` / `webSearchDuckDuckGo`; Bing markup parser (`<li class="b_algo">` → `<h2><a>` title, `ck/a?…&u=a1<base64url>` redirect decode, first-`<p>` snippet) + dependency-free `base64UrlDecode` (no atob/Buffer in the sandbox) |
| `sdk/org/libs/core/system-spaces/system-global/functions/webFetch.ts` | Companion `webFetch(url)` — fetch a page, reduce HTML → text/markdown (regex `htmlToText`/`htmlToMarkdown`). `render` opt (`'auto'` default / `'force'` / `'off'`): in `auto`, when the plain fetch looks **dynamic** (`looksDynamic`: thin readable text + a JS-shell signal — SPA-root `id=root/app/__next`·`data-reactroot`·`ng-app`, `<noscript>`, near-empty+script, OR **inline-`<script>` bytes ≫ visible text**, the data-injection case like `quotes.toscrape.com/js/`) or is bot-walled (403/429), it re-fetches through the **render service** (`renderViaService`, same `/content` endpoint as Bing) and **adopts the render only if it yields more text**; returns `rendered?: boolean`. No-op when `RENDER_SERVICE_URL` unset. |
| `sdk/org/libs/core/src/eval/turn-loop.ts` | Runtime dependency of webFetch's auto path: the yield-servicing loop drains `vm.pendingYields` until the statement fully returns, so a helper that awaits host calls **sequentially** (webFetch's plain fetch → render fetch = two yields) completes both. Before this fix only the first was serviced and the caller bound the raw first `Response`. Bounded by `MAX_SEQUENTIAL_YIELDS`. |
| `sdk/org/libs/core/src/spaces/system-functions.test.ts` | `webSearch`/`webFetch` unit tests (fetch stubbed via `injectGlobal`; Bing parse, ck/a decode, internal-link skip, auto-selection, auto→DDG fallback, unset-URL `ok:false`) |
| `devops/argocd/core/render.yaml` | Render service Deployment (`ghcr.io/browserless/chromium:v2.38.1`, `/dev/shm` emptyDir, tcpSocket probes) + ClusterIP Service + NetworkPolicy |
| `devops/argocd/core/kustomization.yaml` | Registers `render.yaml` with the `lmthing-core` ArgoCD app |
| `devops/argocd/core/gateway.yaml` | Gateway env: `RENDER_SERVICE_TOKEN` (optional `secretKeyRef`) |
| `devops/ansible/roles/cloud_secrets/tasks/main.yml` · `vault.yml.example` · `vault.yml` | `RENDER_SERVICE_TOKEN` in `lmthing-secrets` (sourced from `vault_render_service_token`) |
| `cloud/gateway/src/lib/compute.ts` | `litellmEnvDefaults` + `injectLiteLLMEnv` inject `RENDER_SERVICE_URL`/`RENDER_SERVICE_TOKEN` into every pod's `user-env` |

## Gotchas

- **`webSearchBing` can't run in plain Node.** It relies on the sandbox's *synchronous*
  `response.text()`; real Node `fetch().text()` is a Promise. Test it through the runtime, or by
  fetching HTML separately and running the pure parser against it.
- **A single `webFetch`/`webSearch` call may do TWO sequential host fetches** (webFetch auto:
  plain→render; webSearch auto: Tavily→Bing→DDG). The turn loop MUST loop-service yields until the
  statement returns (`turn-loop.ts`) or the caller binds the raw first `Response` — a real bug found
  live on a pod (the render fetch was left dangling). `resolveFetchYield` never rejects, so these
  sequential fetches always run to completion.
- **Live-testing a system-global fn on a pod:** drive it with the CLI's `--mock` (a MockHandler
  `.mjs`); `console` is NOT in the agent DTS, so surface results via `writeFileRaw("/tmp/…")` and
  read them back. `--request` is single-shot — it only keeps resuming while a statement yields, so
  chain each non-yielding write with the next fetching call.
- **Browserless ghcr tags are `v`-prefixed** (`v2.38.1`), and pinned (a floating tag + `IfNotPresent`
  serves stale). Confirm the tag exists on ghcr before bumping.
- **`RENDER_SERVICE_URL` unset** (e.g. local dev) ⇒ `webSearchBing` returns `ok:false` and `auto`
  falls straight through to DuckDuckGo — no crash.
- The Bing provider's JSDoc signature IS the model-facing type (system-global overlay derives DTS
  from source — no separate DTS edit needed).

## Testing

- Unit: `pnpm --filter @lmthing/core test -- system-functions` · typecheck: `pnpm --filter @lmthing/core typecheck`.
- Render service in prod (from the K8s node, `port-forward` bypasses the NetworkPolicy via kubelet):
  `kubectl port-forward -n lmthing deploy/render 13000:3000` then `curl -X POST
  'http://127.0.0.1:13000/content?token=$TOK' -d '{"url":"https://www.bing.com/search?q=..."}'`.
  Parse the returned HTML locally with the `webSearchBing` logic.
- Full agent path: run the researcher `research` action on a compute pod (needs the pod's `user-env`
  to carry `RENDER_SERVICE_URL`/`TOKEN`, injected on `/api/compute/ensure`).
