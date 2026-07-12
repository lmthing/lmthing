# Render Service & Agent Web Search

The **render service** is an in-cluster headless-Chromium instance that executes JavaScript
and returns a rendered DOM. Two `system-global` agent functions use it to reach the live web:
**`webSearch`** (ranked results + optional AI answer) and **`webFetch`** (fetch one page,
reduce to text/markdown). Both run inside the compute pod's QuickJS WASM sandbox, whose only
network primitive is the yielding `fetch` global (`sdk/org/libs/core/src/globals/fetch.ts`) —
so anything needing a *rendered* DOM POSTs to the render service. This page documents the
render service deployment, the two functions, their provider chains, and how the runtime
globals reach the service.

- Runtime-globals context (how functions are injected/gated): [../runtime-globals/events-and-integrations.md](../runtime-globals/events-and-integrations.md)
- Cloud gateway that injects the render env into pods: [./README.md](./README.md)

---

## `webSearch()`

`webSearch(query, opts)` is a `system-global` function — injected into every agent, fork, and
delegate — declared and dispatched in `sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts`.

Signature (`webSearch.ts:12-27`):

```ts
webSearch(
  query: string,
  opts?: {
    depth?: 'basic' | 'advanced';
    maxResults?: number;                       // default 5
    topic?: 'general' | 'news';
    timeRange?: 'day' | 'week' | 'month' | 'year';
    provider?: 'tavily' | 'bing' | 'duckduckgo' | 'auto';  // default 'auto'
  },
): Promise<{
  ok: boolean;
  query: string;
  answer: string;                              // Tavily only; '' otherwise
  results: Array<{ title: string; url: string; snippet: string; score: number }>;
  error?: string;
}>
```

The function-level JSDoc (`webSearch.ts:1-11`) IS the model-facing type — the system-global
overlay derives the agent DTS from source, so there is no separate `.d.ts` to edit.

### The `auto` provider chain

`provider` (default `'auto'`) selects the backend. `auto` tries providers in order and returns
the **first that succeeds with results** (`webSearch.ts:35-48`):

1. **`tavily`** — keyed API (`TAVILY_API_KEY`). The only provider with an AI-synthesized
   `answer`. Tried only when the key is present. It is **authoritative whenever its call is
   `ok`** and is NOT gated on result count — Tavily can legitimately return an `answer` with
   zero results, so `auto` returns it on `t.ok` alone (`webSearch.ts:41-44`).
2. **`bing`** — renders `https://www.bing.com/search?…` **with JavaScript** via the render
   service, then scrapes the rendered DOM. No key. Only "wins" in `auto` when
   `b.ok && b.results.length > 0` (`webSearch.ts:45-46`).
3. **`duckduckgo`** — plain `fetch` of the no-JS `html.duckduckgo.com` endpoint + regex scrape.
   No key, no render service. The always-available last resort (`webSearch.ts:47`).

So: `auto` → Tavily (if keyed) → Bing (if `RENDER_SERVICE_URL` set) → DuckDuckGo. Each stage
falls through on failure/empty, so a missing key, an unset render URL, or an empty/blocked Bing
page degrades gracefully to the next provider.

> **Correction (code vs. stale infra comments):** two deploy-side comments still call this the
> "google provider" that renders "Google's results page" — `devops/argocd/core/render.yaml:18-23`
> and `cloud/gateway/src/lib/compute.ts:351-353`. The **code uses Bing, not Google**
> (`webSearch.ts:112-156`, function `webSearchBing`). Google was abandoned: it serves datacenter
> IPs a consent/bot **redirect loop** that never settles, so the headless browser times out on
> every wait strategy — an **IP-based** block that rendering cannot fix. Bing renders cleanly
> through the same service (`webSearch.ts:8-9,105-111`). Treat the infra comments as stale.

### `tavily` provider

`webSearchTavily` (`webSearch.ts:66-103`) POSTs `https://api.tavily.com/search` with `api_key`,
`query`, `search_depth` (from `opts.depth`, default `'basic'`), `max_results`,
`include_answer: true`, and optionally `topic`/`time_range`. `topic: 'news'` + `timeRange` bias
results toward recent coverage instead of evergreen pages (Tavily only) — the JSDoc steers agents
to use these for "latest developments" angles rather than faking recency in the query text
(`webSearch.ts:9-11`). Results map `content → snippet`; the API's `score` passes through.

When `provider: 'tavily'` is requested explicitly but `TAVILY_API_KEY` is unset, the function
returns `{ ok: false, error: 'TAVILY_API_KEY not set in environment' }` (`webSearch.ts:51-53`).

### `bing` provider (uses the render service)

`webSearchBing` (`webSearch.ts:112-156`):

- Reads `RENDER_SERVICE_URL`; if unset, returns `{ ok: false, error: 'RENDER_SERVICE_URL not set…' }`
  so `auto` falls straight through to DuckDuckGo — no crash (`webSearch.ts:113-116`).
- Builds `https://www.bing.com/search?q=…&count=<maxResults+5>&setlang=en&cc=us` and POSTs it to
  `${RENDER_SERVICE_URL}/content?token=<RENDER_SERVICE_TOKEN>` with body
  `{ url, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 15000 } }` (`webSearch.ts:118-129`).
  `waitUntil: 'domcontentloaded'` is deliberate — the default `load` can hang ~30s on a search
  page waiting for trackers/beacons (`webSearch.ts:126-127`).
- On the returned HTML, splits on the block marker `<li class="b_algo"`, and per block extracts
  the `<h2><a href>` title and first `<p>` snippet (`webSearch.ts:142-154`).
- **Redirect decode** — Bing links every organic result through a
  `bing.com/ck/a?…&u=a1<base64url>` redirector; `decodeBingRedirect` (`webSearch.ts:161-168`)
  recovers the real target from the base64url payload after the `a1` scheme marker. A direct
  (non-`ck`) absolute href passes through; anything else (or a bing.com host) yields `''`.
- **base64url decode without atob/Buffer** — `base64UrlDecode` (`webSearch.ts:179-197`) is a
  dependency-free decoder because the sandbox exposes neither `atob` nor `Buffer`. URLs are
  ASCII, so the Latin1 byte string it yields is the target verbatim.
- **Internal-host skip** — `isInternalBingHost` (`webSearch.ts:172-174`) drops `bing.com`,
  `go.microsoft.com`, and `microsofttranslator.com` results so Bing's own chrome isn't returned.
- Score is rank-based: `Math.max(0.1, 1 - i*0.1)` (`webSearch.ts:153`). `answer` is always `''`.

### `duckduckgo` provider

`webSearchDuckDuckGo` (`webSearch.ts:202-224`) plain-`fetch`es `https://html.duckduckgo.com/html/?q=…`
with a `lmthing-research/1.0` UA, regex-scrapes `result__a`/`result__snippet` blocks, and decodes
the `/l/?uddg=<encoded>` redirect via `decodeRedirectUrl` (`webSearch.ts:242-250`). Rank-based
score, no `answer`, no render service — the always-available fallback.

---

## `webFetch()`

`webFetch(url, opts)` (`sdk/org/libs/core/system-spaces/system-global/functions/webFetch.ts:16-62`)
fetches a single URL and reduces the body to readable content.

Signature (`webFetch.ts:16-19`):

```ts
webFetch(
  url: string,
  opts?: { maxChars?: number; format?: 'text' | 'html' | 'markdown'; render?: 'auto' | 'force' | 'off' },
): Promise<{ ok: boolean; status: number; content: string; truncated: boolean; rendered?: boolean; error?: string }>
```

- `maxChars` default `20000`; `format` default `'text'`; `render` default `'auto'` (`webFetch.ts:20-22`).
- `format` reduces the body via `reduce` (`webFetch.ts:67-73`): `'text'` → `htmlToText`
  (`webFetch.ts:129-147`, tags stripped, entities decoded), `'markdown'` → `htmlToMarkdown`
  (`webFetch.ts:153-182`, keeps headings/links/lists/bold/italic/code), `'html'` → raw source.
  The char cap applies **after** reduction, so it counts useful content, not markup.

### `render` modes and the render-service fallback

`render` controls whether/when `webFetch` re-fetches through the render service
(`renderViaService`, `webFetch.ts:81-100` — the same `/content` endpoint and request shape Bing
uses):

- **`'force'`** — go straight to the render service; fall back to a plain fetch only if the
  service is unset/unreachable (`webFetch.ts:26-30`). Renders even a content-rich static page.
- **`'off'`** — plain fetch only; never renders (`render === 'auto'` guards the fallback paths).
- **`'auto'` (default)** — re-fetches through the render service in two cases, and **adopts the
  render only if it yields more readable text**:
  - **bot-wall**: the plain fetch returned 403/429 (`webFetch.ts:37-40`) — a real browser often
    clears it; the render result is returned on `r.ok`.
  - **dynamic page**: the plain fetch succeeded but `looksDynamic(rawHtml, htmlToText(rawHtml))`
    is true (`webFetch.ts:51-59`); the richer of plain vs. rendered content wins
    (`rendered.content.length > plain.content.length`).

`rendered?: boolean` in the result reports whether the returned content came from the render
service (`webFetch.ts:28,39,56`). The fallback is a **no-op when `RENDER_SERVICE_URL` is unset**
— `renderViaService` returns `{ ok: false }` and `webFetch` keeps the plain fetch (`webFetch.ts:82-83`).

### `looksDynamic` heuristic

`looksDynamic` (`webFetch.ts:115-124`) decides whether a plain-fetched page looks client-rendered.
Only pages whose readable text is **thin** (`< 200` chars) are candidates; a content-rich page is
returned as-is (`webFetch.ts:116`). Among thin pages it is "dynamic" when the raw HTML shows JS
builds the content:

- a known SPA root element — `id="root"|"app"|"__next"`, `data-reactroot`, or `ng-app` (`webFetch.ts:117`);
- a `<noscript>` / "enable JavaScript" notice (`webFetch.ts:118`);
- a near-empty body (`< 50` chars) with any `<script>` (`webFetch.ts:119`);
- **inline-script dominance** — inline `<script>…</script>` bytes `>= 1000` and `> reducedText.length*4`
  (e.g. a data-injection page like `quotes.toscrape.com/js/`) (`webFetch.ts:120-122`).

A bare external analytics `<script src>` (no inline bytes) on a short static page does NOT trigger.
Correctness doesn't hinge on this being perfect: the caller only ADOPTS the render when it yields
more text, so an over-trigger merely wastes one render (`webFetch.ts:108-114`).

---

## The render service (self-hosted headless Chromium)

Deployed by ArgoCD from `devops/argocd/core/render.yaml` (registered in
`devops/argocd/core/kustomization.yaml`). It is a **browserless/chromium** container.

### Deployment (`render.yaml:16-70`)

- Image `ghcr.io/browserless/chromium:v2.38.1`, `imagePullPolicy: IfNotPresent`, port `3000`
  (`render.yaml:24-27`). Public upstream image, pulled directly (no ACR pull secret), **pinned to
  a concrete `v`-prefixed tag** — a floating tag + `IfNotPresent` would serve a stale cached image
  (`render.yaml:18-23`).
- Env `CONCURRENT=5`, `TIMEOUT=30000` (`render.yaml:29-32`).
- **Token auth** — `TOKEN` from `lmthing-secrets` key `RENDER_SERVICE_TOKEN` (`render.yaml:38-42`).
  Every `/content` request must present it as `?token=`. **Required, not optional** — fail-closed:
  the pod won't start until `make deploy-secrets` populates the key (`render.yaml:33-37`).
- `/dev/shm` is an in-memory `emptyDir` (512Mi) — Chromium needs more shared memory than the
  default 64Mi container `/dev/shm` (`render.yaml:50-53,66-70`).
- Resources: 1Gi/500m requests, 2Gi/1500m limits (`render.yaml:43-49`).
- **Probes are `tcpSocket`, not `httpGet`** (`render.yaml:54-65`) — with `TOKEN` set, browserless
  gates its HTTP routes, so a token-less kubelet `httpGet` probe would 401 and the pod would never
  go Ready.

### Reachability & hardening

The service is reachable **only from compute pods inside the cluster**:

- **`type: ClusterIP`** and **no Envoy HTTPRoute** references it → never externally reachable
  (`render.yaml:78-86`).
- A **NetworkPolicy** `render-allow-compute` (`render.yaml:88-113`) flips the render pod to
  default-deny ingress, admitting traffic only from namespaces labeled
  `lmthing.cloud/type: compute` on TCP 3000. Every gateway-created `user-<id>` namespace carries
  that label, and no other namespace does. Calico enforces standard NetworkPolicy. Kubelet health
  probes still work — they originate from the node, not a pod (`render.yaml:89-93`).

---

## How the runtime globals reach the service

The compute pod reads `RENDER_SERVICE_URL` and `RENDER_SERVICE_TOKEN` from `process.env`
(`webSearch.ts:113,117` · `webFetch.ts:82,84`). The gateway injects both into every pod's
`user-env` secret.

- **Defaults** — `litellmEnvDefaults` (`cloud/gateway/src/lib/compute.ts:343-370`) sets
  `RENDER_SERVICE_URL = "http://render.lmthing.svc.cluster.local:3000"` (the in-cluster Service
  DNS name) and `RENDER_SERVICE_TOKEN = process.env.RENDER_SERVICE_TOKEN ?? ""` (the gateway's own
  copy of the same `lmthing-secrets` key) (`compute.ts:354-355`).
- **Authoritative merge** — `injectLiteLLMEnv` (`compute.ts:377-397`) merges defaults under the
  user's existing env but then **force-overwrites** both render vars from defaults
  (`compute.ts:386-389`), so a stale or user-set value can't misroute or break the search
  providers. The `TOKEN` value therefore matches the render pod's (`render.yaml:38-42` reads the
  same secret key).

When `RENDER_SERVICE_URL` is unset (e.g. local dev, or a non-cloud CLI run), the render service
is simply skipped: `webSearchBing` returns `ok:false` (→ DuckDuckGo) and `webFetch`'s render
fallback no-ops (→ plain fetch). Neither crashes.

### Gating: which agents/tasks may call these

`webSearch`/`webFetch` are `system-global`, so they exist in every agent's DTS by default. Whether
a given **tasklist task** may call them is set by frontmatter, host-enforced:

- A task's `functions:` allowlist names the functions it may use;
  **`functions: []` = no functions at all, including `webSearch`/`webFetch`**; omitting the key =
  all. The `system-research` tasklists opt in explicitly — e.g.
  `sdk/org/libs/core/system-spaces/system-research/tasklists/deep_research/03-investigate.md:13-15`
  lists `webSearch`/`webFetch`, and `01-scope.md`/`research/01-answer.md` do likewise.
- For **project-app agents**, a `tools:use: { allow: [...] }` capability in `instruct.md`
  frontmatter is the host-tool allowlist (`sdk/org/libs/core/src/spaces/capabilities.ts:14`,
  `allow` is required — there is no "use anything").

---

## Runtime dependency: sequential yields

A single `webSearch`/`webFetch` `auto` call can make **two sequential host `fetch`es** (webFetch:
plain → render; webSearch: Tavily → Bing → DDG). The turn loop's yield-servicing loop drains
`vm.pendingYields` until the statement fully returns, so both complete
(`sdk/org/libs/core/src/eval/turn-loop.ts:617-651`, bounded by `MAX_SEQUENTIAL_YIELDS = 64`,
`turn-loop.ts:28`). Before this loop existed, only the first yield was serviced and the caller
bound the raw first `Response` — a real bug where the render fetch was left dangling. This is why
`webSearchBing`/`renderViaService` rely on the sandbox's **synchronous** `response.text()` and
cannot be exercised in plain Node (`webFetch.ts:79-80`, `webSearch.ts:136`).

---

## Tests

`sdk/org/libs/core/src/spaces/system-functions.test.ts` exercises both functions through the
runtime (fetch stubbed via `injectGlobal`):

- **webFetch** (`system-functions.test.ts:174-334`): tag/script/style stripping + entity decode;
  `format:'html'`/`'markdown'`; `render:'auto'` on a JS-shell page, a data-injection page, and a
  403 bot-wall; `render:'auto'` NOT rendering a content-rich static page; `render:'off'` never
  rendering; `render:'force'` always rendering; graceful degrade when `RENDER_SERVICE_URL` unset.
- **webSearch** (`system-functions.test.ts:336-486`): DuckDuckGo fallback with redirect decode;
  Tavily when keyed; `provider:'duckduckgo'` forcing the scrape; `provider:'bing'` render + parse
  + `ck/a` decode + internal-link skip; `auto` choosing Bing over DDG when `RENDER_SERVICE_URL`
  is set; `auto` falling through to DDG when Bing renders no results; `provider:'bing'` returning
  `ok:false` when `RENDER_SERVICE_URL` unset.

Run: `pnpm --filter @lmthing/core test -- system-functions` · typecheck:
`pnpm --filter @lmthing/core typecheck`.

### Live/prod checks

- Render service from a cluster node (port-forward bypasses the NetworkPolicy via kubelet):
  `kubectl port-forward -n lmthing deploy/render 13000:3000`, then POST
  `http://127.0.0.1:13000/content?token=$TOK` with `{"url":"https://www.bing.com/search?q=…"}`,
  and parse the returned HTML locally with the `webSearchBing` logic.
- Full agent path: run a `system-research` action on a compute pod whose `user-env` carries
  `RENDER_SERVICE_URL`/`RENDER_SERVICE_TOKEN` (injected on `/api/compute/ensure`).

---

## Gotchas

- **Bing, not Google** — Google's datacenter-IP consent/bot redirect loop is IP-based and
  rendering cannot fix it; Bing renders cleanly (`webSearch.ts:8-9`). If real Google is ever
  required, use a SERP API / residential proxy, not the render service.
- **`RENDER_SERVICE_URL` unset ⇒ no crash** — `webSearchBing` returns `ok:false` → `auto` uses
  DuckDuckGo (`webSearch.ts:113-116`); `webFetch` render fallback no-ops → plain fetch
  (`webFetch.ts:82-83`).
- **The Bing/render path only runs through the runtime** — it depends on the sandbox's synchronous
  `response.text()`; real Node `fetch().text()` is a Promise (`webFetch.ts:79-80`).
- **Browserless tags are `v`-prefixed and must be pinned** — a floating tag + `IfNotPresent` serves
  stale (`render.yaml:18-25`). Confirm the tag exists on ghcr before bumping.
- **The render service's isolation is the NetworkPolicy + ClusterIP + token, not the pod** — keep
  all three (`render.yaml:33-42,78-113`).
</content>
