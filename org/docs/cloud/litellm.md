# LiteLLM — the `/v1/*` model proxy

LiteLLM is the OpenAI-compatible LLM proxy that fronts **Azure AI Foundry**. It is the second of the two processes that make up `cloud/` (the other is the Gateway — see [README.md](./README.md)). Everything model-shaped in lmthing — every agent turn, every image analysis, every audio transcription — flows through it. It exists so that:

- **Azure credentials never touch a user pod.** Only LiteLLM holds `AZURE_API_KEY`/`AZURE_API_BASE`; pods authenticate with their own per-user *virtual key* (`devops/argocd/core/litellm.yaml:129-138`).
- **Spend is metered and capped per user.** Each user key carries rolling budget windows enforced server-side by LiteLLM (see [billing-and-tiers.md](./billing-and-tiers.md)).
- **One OpenAI-compatible surface** (`/v1/chat/completions`, `/v1/audio/transcriptions`) hides the Azure deployment details from the runtime.

It runs as an **upstream image, not lmthing code** — `ghcr.io/berriai/litellm:v1.90.0` (`devops/argocd/core/litellm.yaml:113`). The only lmthing artifacts are its config (a ConfigMap) and the Gateway's admin-API client.

---

## Deployment & serving

LiteLLM is a K8s Deployment + Service in the `lmthing` namespace, ArgoCD-managed from one file (`devops/argocd/core/litellm.yaml`):

| Aspect | Value | Citation |
|---|---|---|
| Image | `ghcr.io/berriai/litellm:v1.90.0`, `imagePullPolicy: IfNotPresent` | `litellm.yaml:113-114` |
| Replicas | 2 | `litellm.yaml:98` |
| Args | `--config /app/config.yaml --port 4000` | `litellm.yaml:115` |
| Config source | ConfigMap `litellm-config`, `config.yaml` key, mounted at `/app/config.yaml` (subPath) | `litellm.yaml:1-6`, `:139-142`, `:162-165` |
| Service | ClusterIP `litellm:4000` in `lmthing` ns | `litellm.yaml:167-179` |
| Probes | readiness `/health/readiness`, liveness `/health/liveliness` on :4000 | `litellm.yaml:150-161` |
| Resources | req 512Mi/250m, limit 2Gi/1500m | `litellm.yaml:143-149` |

Four env vars are injected from the `lmthing-secrets` K8s Secret: `DATABASE_URL`, `LITELLM_MASTER_KEY`, `AZURE_API_KEY`, `AZURE_API_BASE` (`devops/argocd/core/litellm.yaml:118-138`). `DATABASE_URL` points LiteLLM at the in-cluster Postgres for its own tables (user/key registry, spend log); `LITELLM_MASTER_KEY` is the admin key the Gateway uses.

### Version pin — deliberate

The image is pinned to a concrete release, **not** the floating `main-latest`, for two reasons documented at the pin site (`devops/argocd/core/litellm.yaml:109-113`):

1. `imagePullPolicy: IfNotPresent` on a floating tag serves a stale cached digest indefinitely.
2. Multi-window per-key `budget_limits` (the 1d/7d/30d spend caps) require ≥ v1.90.0 — release **1.82.6 silently dropped them**, so tier budgets were never enforced. Bump the tag deliberately.

> A ConfigMap change does **not** roll the pods. K8s won't restart on a mounted-ConfigMap change, so after editing the model list run `kubectl rollout restart deploy/litellm -n lmthing` (`devops/CLAUDE.md` gotchas).

### Ingress route

Envoy routes `lmthing.cloud/v1/*` → the `litellm:4000` Service in `lmthing` (`devops/argocd/envoy/cloud-routes.yaml:27-52`, HTTPRoute `cloud-litellm`, `PathPrefix /v1`). `/api/*` goes to the Gateway instead. Pods, however, reach LiteLLM **in-cluster** to keep model traffic off the public ingress (see below).

---

## Model routing (`model_list`)

The config's `model_list` maps a public `model_name` to an Azure deployment via `litellm_params.model: azure/<deployment>` (`devops/argocd/core/litellm.yaml:13-79`). All models share `api_base: os.environ/AZURE_API_BASE` and `api_key: os.environ/AZURE_API_KEY` — the deployment name in the `azure/…` path is the only thing that differs.

| `model_name` (what pods call) | Azure deployment | api_version | Notes | Citation |
|---|---|---|---|---|
| `DeepSeek-V4-Flash` | `azure/DeepSeek-V4-Flash` | `2024-12-01-preview` | cheapest chat model | `litellm.yaml:14-23` |
| `DeepSeek-V4-Pro` | `azure/DeepSeek-V4-Pro` | `2024-12-01-preview` | mid chat/reasoning | `litellm.yaml:24-33` |
| `Kimi-K2.6` | `azure/Kimi-K2.6` | `2024-12-01-preview` | large reasoning | `litellm.yaml:34-43` |
| `gpt-5.5` | `azure/gpt-5.5` | `2024-12-01-preview` | large chat; has `cache_read_input_token_cost` | `litellm.yaml:44-56` |
| `gpt-5.4-mini` | `azure/gpt-5.4-mini` | `2024-12-01-preview` | cheap **vision**-capable model for the `system-vision` agent | `litellm.yaml:57-68` |
| `whisper-1` | `azure/whisper` | `2024-06-01` | audio transcription; billed per-minute (LiteLLM's built-in `azure/whisper` cost map, so no `model_info`) | `litellm.yaml:69-79` |

The five chat/vision models are the canonical enabled set, mirrored in the Gateway at `cloud/gateway/src/lib/tiers.ts:7-15` (`ENABLED_MODELS`); `whisper-1` is `TRANSCRIBE_MODELS` (`tiers.ts:22`). A user key's allowlist is `TIER_MODELS = [...ENABLED_MODELS, ...TRANSCRIBE_MODELS]` (`tiers.ts:25`) — a key missing `whisper-1` gets a `key_model_access_denied` 403 on `/audio/transcriptions` (`tiers.ts:17-21`).

### `general_settings` / `litellm_settings`

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL

litellm_settings:
  drop_params: true      # silently drop unsupported params instead of erroring
  set_verbose: false
  num_retries: 2
  request_timeout: 120
```
— `devops/argocd/core/litellm.yaml:81-89`.

### Local dev

`devops/local/litellm-config.yaml` mirrors the prod model list but adds a keyless-friendly default, `gpt-4o-mini` → `openai/gpt-4o-mini` (`devops/local/litellm-config.yaml:1-7`). The Azure models are loaded but inert unless `AZURE_API_KEY`/`AZURE_API_BASE` are set, so keyless local dev still works via `gpt-4o-mini` (`:8-10`). Its `general_settings.database_url` is hard-coded to the local Postgres (`:49-51`), and it omits `gpt-5.4-mini`/`whisper-1` and the `num_retries`/`request_timeout` settings.

---

## Pricing — the 15% markup, generated

Per-token costs in `model_info` are **generated, not hand-written**. `cloud/scripts/generate-litellm-models.ts` reads base Azure prices from `sdk/org/libs/cli/prices/azure.json` (per-1K tokens) and applies:

```
input_cost_per_token = inputPer1K / 1000 * 1.15
```
— the 15% gateway markup (`generate-litellm-models.ts:22-23`, `:42-49`). It prints a `model_list:` block to paste into `devops/argocd/core/litellm.yaml` (the ArgoCD YAML stays the source of truth; the script keeps the markup deterministic — `generate-litellm-models.ts:10-13`). Run it with `cd cloud && pnpm litellm:generate-models` (the config header, `litellm.yaml:8-12`). The script's `ENABLED_MODELS` list must match the Gateway's (`generate-litellm-models.ts:30-31`) and it emits an optional `cache_read_input_token_cost` when the source has `cachedInputPer1K` (`:75-77`), as gpt-5.5 does (`litellm.yaml:56`). `whisper-1` gets no `model_info` — LiteLLM bills it per-minute from its own cost map.

Base prices are refreshed with `pnpm fetch-azure-prices` in `sdk/org/libs/cli` (`generate-litellm-models.ts:5-6`).

---

## How the pod runtime calls LiteLLM

An agent turn resolves a model spec `provider:modelId` to an AI-SDK `LanguageModel` in `sdk/org/libs/cli/src/providers/resolve.ts`. The lmthing.cloud path is the `lmthingcloud` case (`resolve.ts:49-57`):

```ts
case 'lmthingcloud': {
  const { createOpenAI } = await import('@ai-sdk/openai');
  const apiKey = process.env['LMTHINGCLOUD_API_KEY'];
  if (!apiKey) throw new Error('LMTHINGCLOUD_API_KEY env var is required for lmthingcloud: provider');
  const baseURL = process.env['LMTHINGCLOUD_BASE_URL'] || 'https://lmthing.cloud/v1';
  // `.chat()` — v5's default is the Responses API, which the LiteLLM→Azure path rejects.
  return createOpenAI({ baseURL, apiKey }).chat(modelId) as unknown as LanguageModel;
}
```

Key points, all grounded in `resolve.ts:13-16, 49-57`:

- **`modelId` is the LiteLLM `model_name` verbatim** — e.g. `lmthingcloud:DeepSeek-V4-Flash` calls the `DeepSeek-V4-Flash` entry, which LiteLLM forwards to `azure/DeepSeek-V4-Flash`.
- **`.chat()` pins the Chat Completions API.** AI SDK v5's default callable switched to the OpenAI *Responses* API, which the LiteLLM→Azure path rejects on older api-versions ("Responses API is enabled only for api-version 2025-03-01-preview and later" — `resolve.ts:39-43, 54-55`). The plain `openai:` provider does the same (`resolve.ts:34-43`).
- **`LMTHINGCLOUD_API_KEY`** is the user's own virtual key (carrying their tier budget windows); **`LMTHINGCLOUD_BASE_URL`** overrides the endpoint, defaulting to the public `https://lmthing.cloud/v1`.

Audio transcription mirrors this in `sdk/org/libs/cli/src/providers/transcribe.ts:32-39` — the `lmthingcloud` transcription provider also uses `createOpenAI({ baseURL, apiKey }).transcription(modelId)` against `{baseURL}/audio/transcriptions` (`transcribe.ts:34`), with the same env vars.

The turn-loop that drives these model calls is documented in [../runtime/turn-loop.md](../runtime/turn-loop.md).

### Env the Gateway injects into every pod

The Gateway stamps the LiteLLM wiring into the pod's `user-env` secret via `litellmEnvDefaults()` (`cloud/gateway/src/lib/compute.ts:343-370`). Critically, pods hit LiteLLM **in-cluster**, not the public ingress:

```ts
LMTHINGCLOUD_API_KEY:  litellmKey,   // the user's own virtual key
LMTHINGCLOUD_BASE_URL: "http://litellm.lmthing.svc.cluster.local:4000/v1",
LM_MODEL_XS:   "lmthingcloud:DeepSeek-V4-Flash",
LM_MODEL_S:    "lmthingcloud:DeepSeek-V4-Flash",
LM_MODEL_M:    "lmthingcloud:DeepSeek-V4-Pro",
LM_MODEL_L:    "lmthingcloud:gpt-5.5",
LM_MODEL_M_R:  "lmthingcloud:DeepSeek-V4-Pro",
LM_MODEL_L_R:  "lmthingcloud:Kimi-K2.6",
LM_MODEL_VISION:     "lmthingcloud:gpt-5.4-mini",   // system-vision agent
LM_TRANSCRIBE_MODEL: "lmthingcloud:whisper-1",       // chat audio feature
```
— `cloud/gateway/src/lib/compute.ts:345-368`.

`LM_MODEL_{XS,S,M,L,M_R,L_R}` are the size/role aliases the runtime resolves; the runtime picks one and passes the `lmthingcloud:<model>` value to `resolveModel`. `injectLiteLLMEnv()` merges these into the pod secret without clobbering user-set vars, **except** `LMTHINGCLOUD_API_KEY`, which always tracks the user's current subscription key (`compute.ts:377-397`, esp. `:383-385`).

The user's virtual key itself is minted by the Gateway calling `litellm.generateKey(userId, TIERS.free, \`compute-${userId}\`)` — the key alias is scoped per user because LiteLLM requires globally-unique aliases (`compute.ts:320-333`). LiteLLM never returns a key's raw secret after creation, so on a re-provision the Gateway recovers it from the pod's existing env (`compute.ts:325-331`).

---

## The admin-API client (`lib/litellm.ts`)

Gateway-side, all LiteLLM administration goes through a thin HTTP client, `cloud/gateway/src/lib/litellm.ts`, which authenticates with `LITELLM_MASTER_KEY` (`litellm.ts:4-23`, target `LITELLM_URL || "http://litellm:4000"`). Every call is `request(path, method, body?)` → `Bearer <master key>` (`litellm.ts:7-23`). The master key bypasses per-key budget gates, so admin ops work even when a user's own key is over-budget and 429s (`litellm.ts:103-105`).

| Function | LiteLLM endpoint(s) | Purpose | Citation |
|---|---|---|---|
| `createUser(userId, tier, meta?)` | `POST /user/new` | create a LiteLLM user with `budget_limits`, model allowlist, `tpm_limit`/`rpm_limit` | `litellm.ts:25-38` |
| `generateKey(userId, tier, alias?)` | `POST /key/generate` | mint a virtual key inheriting the tier's budget windows + limits | `litellm.ts:40-54` |
| `updateUserTier(userId, tier)` | `POST /user/update` **then** `POST /key/update` per key | change tier; **budget windows are set on the KEY, not the user** — the user table has no `budget_limits` column and passing it 400s, so user-update carries only non-budget attrs and each key gets the new `budget_limits` | `litellm.ts:56-81` |
| `listKeys(userId)` | `GET /key/list?user_id=…` | list a user's keys (returns hashed tokens) | `litellm.ts:83-89` |
| `deleteKey(keyId)` | `POST /key/delete` | revoke a key | `litellm.ts:91-93` |
| `getUserInfo(userId)` | `GET /user/info?user_id=…` | user record | `litellm.ts:95-97` |
| `getKeyInfo(token)` | `POST /key/info` | key record | `litellm.ts:99-101` |
| `getUserDailySpend(userId, start, end)` | `GET /user/daily/activity` (paginated) | `YYYY-MM-DD → spend` map for usage/budget UI; master key works even when the user key is over-budget | `litellm.ts:103-131` |

`budget_limits`, `tpm_limit`, `rpm_limit`, and the model allowlist all come from the `Tier` object via `toBudgetLimits(tier)` — see [billing-and-tiers.md](./billing-and-tiers.md) for the tier/budget-window model. The `updateUserTier` two-step (user attrs, then per-key budgets) is the fix for a real bug where a `budget_limits` field on `/user/update` 400'd and aborted the whole tier change before any key updated (`litellm.ts:56-61`).

---

## Cross-links

- [README.md](./README.md) — the `cloud/` backend overview (Gateway + LiteLLM, ingress split)
- [billing-and-tiers.md](./billing-and-tiers.md) — tiers, budget windows (`budget_limits`), usage metering
- [routes.md](./routes.md) — the Gateway `/api/*` routes (auth, keys, billing, compute)
- [../runtime/turn-loop.md](../runtime/turn-loop.md) — the agent turn loop that issues the model calls
