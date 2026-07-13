# Adding a provider

"Provider" means three different things in lmthing, wired in three different places. Pick the one you actually need:

| You want to… | Add it in | Section |
|---|---|---|
| Offer a new **model on the managed `lmthing.cloud` LLM proxy** (what every user pod calls by default) | LiteLLM `model_list` + Gateway `ENABLED_MODELS` | [A](#a-add-a-model-to-the-managed-lmthingcloud-provider-litellm) |
| Let the runtime call a **new LLM vendor via an API key** (Groq, Bedrock, a BYO-key path) | `resolveModel` in `sdk/org/libs/cli/src/providers/resolve.ts` | [B](#b-add-a-raw-ai-sdk-llm-provider-resolvets) |
| Add a **web-search backend** for the agent `webSearch()` global | the `auto` chain in `webSearch.ts` | [C](#c-add-a-web-search-provider) |

The runtime resolves a model from a `provider:modelId` spec (`sdk/org/libs/cli/src/providers/resolve.ts:18-31`). The `provider` slice selects the AI-SDK adapter; `modelId` is passed through verbatim. So `lmthingcloud:DeepSeek-V4-Flash` (A) and `groq:llama-3.3-70b` (B) both flow through the same `resolveModel` switch — the difference is which `case` handles them.

---

## A. Add a model to the managed `lmthing.cloud` provider (LiteLLM)

This is the common case: expose one more Azure AI Foundry deployment to all users. No pod-runtime code changes — the pod already calls `lmthingcloud:<model>` (`resolve.ts:49-57`), and `modelId` is the LiteLLM `model_name` verbatim (`resolve.ts:14-16`). You are adding a `model_name` to LiteLLM and allowlisting it on user keys. Full LiteLLM architecture: [../cloud/litellm.md](../cloud/litellm.md).

### 1. Add the deployment to `ENABLED_MODELS` (two lists that must match)

- **Gateway** — `cloud/gateway/src/lib/tiers.ts:7-15`. Every tier's LiteLLM key allowlist is `TIER_MODELS = [...ENABLED_MODELS, ...TRANSCRIBE_MODELS]` (`tiers.ts:25`); a key missing a model gets a `key_model_access_denied` 403 (`tiers.ts` comment `:17-21`).
- **Pricing generator** — `cloud/scripts/generate-litellm-models.ts:30-31`. Its `ENABLED_MODELS` "must match gateway ENABLED_MODELS + tiers.ts" (comment at `:29`).

### 2. Add the base price

Per-token costs are **generated, not hand-written**. Add the model's per-1K prices to `sdk/org/libs/cli/prices/azure.json` (refreshed by `pnpm fetch-azure-prices` in `sdk/org/libs/cli` — `sdk/org/libs/cli/package.json:20`). Missing entries make the generator `process.exit(1)` with a "Missing from …" error (`generate-litellm-models.ts:83-89`).

### 3. Generate the `model_list` block and paste it into the ArgoCD YAML

```bash
cd cloud && pnpm litellm:generate-models   # → tsx scripts/generate-litellm-models.ts
```

The script reads `azure.json`, applies the **15% gateway markup** (`input_cost_per_token = inputPer1K / 1000 * 1.15`, `generate-litellm-models.ts:22-23` `MARKUP`, `:42-47`), and prints a `model_list:` block (`:59-79`) to paste into `devops/argocd/core/litellm.yaml`. The ArgoCD YAML stays the source of truth; the script only keeps the markup deterministic (`generate-litellm-models.ts:10-13`). Each entry maps `model_name` → `azure/<deployment>` with `api_base`/`api_key: os.environ/…` and `api_version` (`:62-70`); an optional `cache_read_input_token_cost` is emitted when the source has `cachedInputPer1K` (`:75-77`).

> A ConfigMap change does **not** roll the LiteLLM pods (K8s doesn't restart on a mounted-ConfigMap change). After editing the model list: `kubectl rollout restart deploy/litellm -n lmthing` (see [../cloud/litellm.md](../cloud/litellm.md)).

### 4. (Optional) Wire it to a size/role alias

The Gateway stamps `LM_MODEL_{XS,S,M,L,M_R,L_R}` / `LM_MODEL_VISION` / `LM_TRANSCRIBE_MODEL` into every pod's `user-env` via `litellmEnvDefaults()` (`cloud/gateway/src/lib/compute.ts:345-368`). To make the runtime *pick* the new model for a size class, point one of those aliases at `lmthingcloud:<model>` there.

### Transcription (Whisper-style) models

Audio models live in a separate list: `TRANSCRIBE_MODELS` (`tiers.ts:22`, e.g. `whisper-1`). They are added to `litellm.yaml`'s `model_list` **by hand, without `model_info`** — LiteLLM bills them per-minute from its built-in `azure/whisper` cost map — so they are intentionally excluded from `generate-litellm-models.ts`'s `ENABLED_MODELS`. See [../cloud/litellm.md](../cloud/litellm.md) for the whisper entry.

---

## B. Add a raw AI-SDK LLM provider (`resolve.ts`)

Use this to let the runtime call a vendor **directly with its own API key** (not through LiteLLM) — e.g. running the CLI locally against Groq, or a BYO-key deployment. Each provider is one `case` in the `resolveModel` switch that lazy-loads a Vercel AI-SDK adapter (`sdk/org/libs/cli/src/providers/resolve.ts:33-97`).

The switch implements exactly **six** cases — `openai` (`resolve.ts:34`), `anthropic` (`:45`), `lmthingcloud` (`:49`), `google` (`:58`), `mistral` (`:62`) and `azure` (`:66`) — and the `default` throws listing exactly those six (`resolve.ts:93-96`). Any other `provider` slice (groq, cohere, bedrock, a generic openai-compatible endpoint, …) does **not** resolve until you add its case.

### Steps

**1. Install the adapter** (the package is `@lmthing/cli`):

```bash
pnpm --filter @lmthing/cli add @ai-sdk/<provider>
```

**2. Add a `case`** to the switch in `sdk/org/libs/cli/src/providers/resolve.ts`. Follow the existing shape — dynamic `import`, read config from `process.env`, cast the result:

```ts
case 'anthropic': {
  const { createAnthropic } = await import('@ai-sdk/anthropic');
  return createAnthropic()(modelId) as unknown as LanguageModel;
}
```
— `resolve.ts:45-48`. Conventions to copy:

- **Lazy `await import`** — adapters are loaded on demand, never top-level.
- **`.chat(modelId)` for OpenAI-compatible surfaces.** AI SDK v5's default callable (`provider(modelId)`) switched to the OpenAI *Responses* API, which the Azure/LiteLLM path rejects on older api-versions; `.chat()` pins Chat Completions (`resolve.ts:39-43`, `:88-91`). Native providers like Anthropic/Google/Mistral use the plain `provider(modelId)` callable (`resolve.ts:47`, `:60`, `:64`).
- **`as unknown as LanguageModel`** — every case casts to the return type (`resolve.ts:43`, `:47`, …).
- **Fail loudly on missing creds** — throw naming the required env var, as the `azure`/`lmthingcloud` cases do (`resolve.ts:52`, `:69-70`).
- **Update the `default` error string** (`resolve.ts:93-96`) and, if you like, the header docstring (`resolve.ts:3-16`).

**3. Add the transcription case too** *(only if the provider serves audio)* — the transcription path is a **separate** switch in `sdk/org/libs/cli/src/providers/transcribe.ts:22-58` (`openai`/`lmthingcloud`/`azure`), each returning `create…().transcription(modelId)`. It mirrors `resolve.ts`'s env handling (`transcribe.ts:16-18`). The default transcription model is `openai:whisper-1`, overridable via `LM_TRANSCRIBE_MODEL` (`transcribe.ts:4-5`, `:63-64`).

**4. Point a model alias at it.** No code change is needed to *define* an alias — there is no union type of alias letters and no env-var map. `resolveAlias(alias)` (`sdk/org/libs/cli/src/providers/aliases.ts`) is fully generic: it reads `process.env['LM_MODEL_' + alias.toUpperCase().replace(/[^A-Z0-9]/g,'_')]` and falls back to returning the string unchanged, so **any** `LM_MODEL_<NAME>` works with zero code changes. Just set the env var:

```bash
# .env at repo root (loaded from process.cwd())
LM_MODEL_M=<provider>:<modelId>
LM_MODEL=M                       # default model when --model omitted
```

**5. Test it:**

```bash
node sdk/org/libs/cli/dist/cli/bin.js --model <provider>:<modelId> --space <spaceDir> "hello"
```

(There is no reference-space tree to point `--space` at: `sdk/org/fixtures/` was deleted in commit
`acb460a`. Use a space you author, or a system space — see [`add-a-space.md`](./add-a-space.md).)

---

## C. Add a web-search provider

Agents search via the `webSearch()` global (`sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts`), injected into every agent/fork/delegate. `opts.provider` (default `'auto'`) selects the backend; today: `tavily`, `bing`, `duckduckgo` (`webSearch.ts:21`, dispatch `:32-59`). Full architecture: [../cloud/render.md](../cloud/render.md).

### Steps

**1. Extend the type union** in the function signature — `provider?: 'tavily' | 'bing' | 'duckduckgo' | 'auto'` (`webSearch.ts:21`). The **JSDoc on this function IS the model-facing type**: the `system-global` overlay derives the agent DTS from source, so no separate `.d.ts` edit is needed — but update the docstring (`webSearch.ts:1-11`) so the agent knows the option exists.

**2. Write a `webSearch<Name>` helper** returning the shared `WebSearchResult` shape `{ ok, query, answer, results:[{title,url,snippet,score}], error? }` (`webSearch.ts:61-64`). Copy an existing one:
- keyed API → model on `webSearchTavily` (`webSearch.ts:66-110`, reads `TAVILY_API_KEY`, the only provider returning a real `answer`);
- JS-rendered page → `webSearchBing` (`webSearch.ts:112-`, POSTs to the render service at `RENDER_SERVICE_URL`);
- plain-HTML scrape → `webSearchDuckDuckGo` (`webSearch.ts:202-`, dependency-free regex, no key, the always-available last resort).

Constraints for the sandbox: use only `fetch`; `response.text()`/`response.json()` are **synchronous** in the QuickJS sandbox (`webSearch.ts:98`, `:208`) — code relying on the Node Promise form won't run on a pod. Parse HTML with regex (no DOM, no `atob`/`Buffer`), matching the rest of the file.

**3. Add the dispatch branch.** Direct selection: an early `if (provider === '<name>') return webSearch<Name>(...)` (`webSearch.ts:35-36`). To join the `auto` chain, insert it in priority order inside the `auto` block (`webSearch.ts:38-51`) — each stage falls through when it fails or returns zero results, so ordering is graceful-degradation order.

**4. Inject any secret/URL into the pod env.** Providers read config from `process.env`. Cluster-wide values (`RENDER_SERVICE_URL`/`RENDER_SERVICE_TOKEN`, `TAVILY_API_KEY`) are stamped into each pod's `user-env` by the Gateway's `litellmEnvDefaults`/`injectLiteLLMEnv` (`cloud/gateway/src/lib/compute.ts`); a new key follows the same path. See [../cloud/render.md](../cloud/render.md).

**5. Test.** Unit tests stub `fetch` and exercise the parsers + `auto` selection: `cd sdk/org && pnpm test libs/core/src/spaces/system-functions` (`sdk/org/libs/core/src/spaces/system-functions.test.ts`; the runner is `vitest run`, `sdk/org/package.json:L9`, and takes a path substring — `pnpm --filter @lmthing/core test` is a silent no-op because that package has no `test` script, see [`testing.md`](./testing.md)). `webSearchBing` **cannot run in plain Node** — it depends on the sandbox's synchronous `response.text()`; test it through the runtime or against pre-fetched HTML.

---

## Which org doc to update

After adding a provider, update the doc for the surface you touched so it stays the single source of truth:

- **A (managed model)** → [../cloud/litellm.md](../cloud/litellm.md) — the `model_list` / `ENABLED_MODELS` tables and the pricing-generation section. Tier/budget impact: [../cloud/billing-and-tiers.md](../cloud/billing-and-tiers.md).
- **B (AI-SDK LLM provider)** → [../runtime/README.md](../runtime/README.md) and this file's Section B list of implemented cases.
- **C (search provider)** → [../cloud/render.md](../cloud/render.md) (the `webSearch`/render-service reference).
