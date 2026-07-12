# Billing and Tiers

Everything about money in lmthing: the four tiers, the Stripe subscription flow, the 15%
token markup, and the budget/usage surfaces. The tier table is defined **once** in
`cloud/gateway/src/lib/tiers.ts` and consumed by the gateway routes, the K8s pod spec, and
the cron scheduler. There is **no credits ledger and no metered/usage-based Stripe billing** —
a subscription buys a *tier*, and the tier's spend caps are enforced by LiteLLM on the user's
API key (grep for `stripe.` shows only `customers.create`, `checkout.sessions`,
`billingPortal.sessions`, `webhooks.constructEvent` — `cloud/gateway/src/routes/billing.ts:35-108`,
`cloud/gateway/src/routes/webhook.ts:19-23`, `cloud/gateway/src/routes/auth.ts:32-35`).

Related: [routes.md](./routes.md) (full route table) · [litellm.md](./litellm.md) ·
[../contributing/add-a-tier.md](../contributing/add-a-tier.md) (checklist) ·
[../cli-api/rest/budget.md](../cli-api/rest/budget.md) (the pod's `/api/budget` relay).

---

## 1. Source of truth

| File | Role |
|---|---|
| `cloud/gateway/src/lib/tiers.ts` | `TIERS` record — budgets, models, tpm/rpm, pod sizing, cron policy + helpers |
| `cloud/gateway/src/lib/stripe.ts` | Stripe client (`new Stripe(process.env.STRIPE_SECRET_KEY!)`) — 2 lines |
| `cloud/gateway/src/routes/billing.ts` | `/api/billing/{checkout,portal,usage,budget,checkout/status}` |
| `cloud/gateway/src/routes/webhook.ts` | `/api/stripe/webhook` — subscription → tier change + pod lifecycle |
| `cloud/gateway/src/lib/litellm.ts` | Applies the tier to LiteLLM users/keys |
| `cloud/gateway/src/lib/budget-math.ts` | Pure rolling-window spend math for `/api/billing/budget` |
| `cloud/gateway/src/lib/compute.ts` | Turns `tier.pod` into a K8s Deployment |
| `cloud/scripts/create-stripe-products.ts` | Idempotent Stripe product/price creation (`pnpm stripe:create-products`) |
| `cloud/scripts/generate-litellm-models.ts` | Emits the marked-up `model_list` (`pnpm litellm:generate-models`) |
| `cloud/scripts/resync-tier-budgets.ts` | Backfills changed budget windows onto existing keys (`pnpm litellm:resync-budgets`) |
| `devops/argocd/core/litellm.yaml` | The deployed `model_list` with the marked-up per-token prices |
| `com/src/config/plans.ts` | The marketing pricing page's plan cards |

Script names: `cloud/package.json:6-10`.

---

## 2. The tiers (verbatim from code)

`cloud/gateway/src/lib/tiers.ts:L88-L163`. Prices come from the Stripe setup script
(`cloud/scripts/create-stripe-products.ts:L23-L27`, amounts in cents).

| Tier | Stripe price | Budget windows (1d / 7d / 30d, USD) | tpm | rpm | Pod (cpu/mem limit) | Pod requests | Idle TTL | Max sessions | Cron floor / max jobs |
|---|---|---|---|---|---|---|---|---|---|
| `free` | none (`stripePriceId: null`) | **10 / 50 / 150** | 1,000,000 | 5,000 | `1500m` / `512Mi` | `50m` / `256Mi` (**Burstable**) | 15 min | 3 | 60 min / 20 |
| `basic` | `$10/mo` — `STRIPE_PRICE_BASIC` | **1 / 4 / 10** | 1,000,000 | 5,000 | `500m` / `768Mi` | = limits (Guaranteed) | 30 min | 3 | 15 min / 50 |
| `pro` | `$20/mo` — `STRIPE_PRICE_PRO` | **3 / 10 / 20** | 1,000,000 | 5,000 | `500m` / `1Gi` | = limits (Guaranteed) | 60 min | 5 | 5 min / 100 |
| `max` | `$100/mo` — `STRIPE_PRICE_MAX` | **10 / 30 / 100** | 1,000,000 | 5,000 | `1000m` / `2Gi` | = limits (Guaranteed) | 120 min | 10 | 5 min / 200 |

Two things the old docs got wrong and the code is unambiguous about:

- **Rate limits are identical on every tier** — `tpmLimit: 1_000_000, rpmLimit: 5_000` for all
  four (`cloud/gateway/src/lib/tiers.ts:L98-L99,L118-L119,L134-L135,L149-L150`). The
  "10K tpm / 60 rpm … 1M tpm / 5K rpm" ladder in `cloud/CLAUDE.md`, `.claude/skills/add-tier.md`
  and `com/src/config/plans.ts` is **not** what the gateway stamps on a key.
- **Free currently has the *largest* budget windows** (10/50/150) — larger than Basic, Pro and
  even Max's 30-day cap. That is what `TIERS.free.budgetLimits` says
  (`cloud/gateway/src/lib/tiers.ts:L92-L96`); tiers differ meaningfully today by **pod sizing,
  session count, idle TTL and cron floor**, not by spend headroom.

### Models

Every tier gets the same allowlist — `TIER_MODELS = [...ENABLED_MODELS, ...TRANSCRIBE_MODELS]`
(`cloud/gateway/src/lib/tiers.ts:L6-L26`):

```ts
export const ENABLED_MODELS = [
  "DeepSeek-V4-Flash",
  "DeepSeek-V4-Pro",
  "Kimi-K2.6",
  "gpt-5.5",
  // Cheap vision-capable model — the system-vision space agent analyzes images
  // on this (delegated from THING); also usable directly as a low-cost model.
  "gpt-5.4-mini",
] as const;

export const TRANSCRIBE_MODELS = ["whisper-1"] as const;
```

That is **five** chat models plus `whisper-1` — not "four models" as `cloud/CLAUDE.md:178`,
`.claude/skills/add-tier.md` and `com/src/config/plans.ts:15` still claim. `whisper-1` must be in
the key's `models` list or LiteLLM 403s `key_model_access_denied` on `/audio/transcriptions`
(`cloud/gateway/src/lib/tiers.ts:L18-L24`).

The pod's model aliases are pinned to these names in the `user-env` secret
(`cloud/gateway/src/lib/compute.ts:L343-L369`): `LM_MODEL_XS/S → DeepSeek-V4-Flash`,
`LM_MODEL_M/M_R → DeepSeek-V4-Pro`, `LM_MODEL_L → gpt-5.5`, `LM_MODEL_L_R → Kimi-K2.6`,
`LM_MODEL_VISION → gpt-5.4-mini`, `LM_TRANSCRIBE_MODEL → lmthingcloud:whisper-1`.

---

## 3. Where each tier field is enforced

| Field | Enforced by | Code |
|---|---|---|
| `budgetLimits` | **LiteLLM**, at the **key** level. `toBudgetLimits()` maps `{duration,maxBudget}` → LiteLLM's `budget_limits: [{budget_duration, max_budget}]` and it is sent on `/user/new`, `/key/generate` and `/key/update`. A request is rejected once **any** window is exhausted. | `cloud/gateway/src/lib/tiers.ts:L186-L193`; `cloud/gateway/src/lib/litellm.ts:L25-L54`, `L56-L81` |
| `models` | LiteLLM key `models` allowlist (same three calls) | `cloud/gateway/src/lib/litellm.ts:L33,L47,L74` |
| `tpmLimit` / `rpmLimit` | LiteLLM user + key `tpm_limit` / `rpm_limit` | `cloud/gateway/src/lib/litellm.ts:L34-L35,L49-L50,L76-L77` |
| `pod.cpu` / `pod.mem` / `pod.cpuRequest` / `pod.memRequest` | The K8s Deployment's `resources` (Burstable when `*Request < limit`, Guaranteed otherwise); `NODE_OPTIONS=--max-old-space-size=` is derived as 60% of the mem limit | `cloud/gateway/src/lib/compute.ts:L226-L241`, `L110-L113` |
| `pod.maxSessions` | Injected as `MAX_SESSIONS` env → the pod's `SessionManager` (`this.maxSessions`), which refuses a new session when all resident sessions are busy | `cloud/gateway/src/lib/compute.ts:L237`; `sdk/org/libs/cli/src/server/session-manager.ts:278`, `:830`, `:943` |
| `pod.idleTtlMinutes` | Injected as `IDLE_TTL_MINUTES` env → `SessionManager.idleTtlMs` (and the pod's self-idle → scale-to-zero) | `cloud/gateway/src/lib/compute.ts:L238`; `sdk/org/libs/cli/src/server/session-manager.ts:280`; `cloud/gateway/src/routes/compute.ts:L65-L82` |
| `cron.minIntervalMs` | `POST /api/compute/cron-manifest` clamps every published job's interval **up** to the floor, and the DB upsert re-enforces it (`next_run_at = GREATEST(next_run_at, last_woken_at + floor)`) | `cloud/gateway/src/routes/compute.ts:L101-L124`; `cloud/gateway/src/lib/db.ts:L299-L324` |
| `cron.maxJobs` | Same route — jobs past the cap are dropped (`if (jobs.length >= policy.maxJobs) break;`) | `cloud/gateway/src/routes/compute.ts:L124` |
| `stripePriceId` | `getTierByPriceId()` in the Stripe webhook; `TIERS[tier].stripePriceId` in `/api/billing/checkout` | `cloud/gateway/src/lib/tiers.ts:L165-L172`; `cloud/gateway/src/routes/webhook.ts:L44`; `cloud/gateway/src/routes/billing.ts:L70-L82` |

The tier name itself lives in **LiteLLM user metadata** (`metadata.tier`), written by
`createUser`/`updateUserTier` (`cloud/gateway/src/lib/litellm.ts:L36,L67`) and read back by
`resolveUserTier()` in the compute route (`cloud/gateway/src/routes/compute.ts:L27-L35`),
`resolvePodConfig()` (`cloud/gateway/src/lib/compute.ts:L437-L447`), `/api/billing/usage`
(`cloud/gateway/src/routes/billing.ts:L138`), `/api/billing/budget` (`:L167`), `/api/keys` POST
(`cloud/gateway/src/routes/keys.ts:L38-L45`) and `/api/auth/me`
(`cloud/gateway/src/routes/auth.ts:L194`). There is no `tier` column in the gateway's own
Postgres schema.

### What is NOT tier-gated (correction)

**No `/api/compute/*` route checks the tier.** `status`, `ensure`, `wake`, `wake-wait`,
`upgrade`, `env` (GET **and** PUT) are behind `authMiddleware` only; the tier is used solely to
*size* the pod (`cloud/gateway/src/routes/compute.ts:L186-L195`, `L199-L221`, `L225-L249`,
`L258-L269`, `L291-L301`, `L306-L340`). Every tier — including `free` — gets a pod
(`cloud/gateway/src/lib/tiers.ts:L44` "Every tier now gets a pod"; route comment
`cloud/gateway/src/routes/compute.ts:L198` "All tiers now have compute access"). The
`cloud/CLAUDE.md:101-104` claim that `/api/compute/status` and `/api/compute/env` "require
pro/max tier" is **stale**. `PUT /api/compute/env` validates key syntax
(`/^[A-Za-z_][A-Za-z0-9_]*$/`), string values, and a **max of 100 vars** — no tier check
(`cloud/gateway/src/routes/compute.ts:L303-L339`).

Nor do `/api/backup`, `/api/inbound`, `/api/status`, `/api/issues` or `/api/keys` reference
`TIERS` at all (grep for `getTierByName|TIERS` across `cloud/gateway/src` returns only
`billing.ts`, `keys.ts` (POST, to *inherit* limits), `compute.ts`, `webhook.ts`, `auth.ts`,
`lib/compute.ts`, `lib/litellm.ts`).

The gateway's own IP rate limiter is a fixed 60 req/min token bucket used only by the status
route — it is not tier-aware (`cloud/gateway/src/middleware/rate-limit.ts:L9-L11,L32`).

---

## 4. Stripe integration

### 4.1 Products & prices (one-time setup)

`cloud/scripts/create-stripe-products.ts` is idempotent: it looks up prices by `lookup_key`
(`lmthing_basic` / `lmthing_pro` / `lmthing_max`), finds-or-creates the single product
`"LMThing API Gateway"`, creates monthly recurring USD prices, and prints the
`STRIPE_PRICE_*` env values to paste into secrets (`:L23-L27`, `:L50-L89`). Run with
`pnpm --filter @lmthing/cloud stripe:create-products` (`cloud/package.json:6`).

The three price IDs and the Stripe keys reach the gateway as env from the `lmthing-secrets`
K8s secret: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`,
`STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX` (`devops/argocd/core/gateway.yaml:90-114`;
placeholders in `cloud/.env.example:17-21`). `tiers.ts` reads them at module load —
`stripePriceId: process.env.STRIPE_PRICE_PRO || ""` (`cloud/gateway/src/lib/tiers.ts:L136`) —
so a **missing env var silently makes that tier un-checkout-able**: `/api/billing/checkout`
rejects it with `400 Invalid tier` because `stripePriceId` is falsy
(`cloud/gateway/src/routes/billing.ts:L70-L73`), and `getTierByPriceId()` skips tiers with an
empty price id (`cloud/gateway/src/lib/tiers.ts:L167`).

### 4.2 Customer creation

A Stripe customer is created at **registration** — `provisionUser()` creates the customer,
then the LiteLLM user on the **free** tier with `metadata.stripe_customer_id`, then the user's
first API key (`cloud/gateway/src/routes/auth.ts:L15-L55`). The customer id is stored *in
LiteLLM user metadata*, not in the gateway DB. `ensureStripeCustomer()` in the billing route is
the lazy fallback for users who predate that (read metadata → else create customer → write it
back via `/user/new`, falling back to `/user/update` merge)
(`cloud/gateway/src/routes/billing.ts:L24-L60`).

### 4.3 Checkout (embedded)

`POST /api/billing/checkout` (JWT) `{ tier, return_url? }` → a **Stripe Embedded Checkout**
session in `subscription` mode, returning `{ client_secret }`
(`cloud/gateway/src/routes/billing.ts:L63-L96`):

```ts
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: "subscription",
  ui_mode: "embedded",
  line_items: [{ price: targetTier.stripePriceId, quantity: 1 }],
  return_url:
    return_url || `${BASE_URL}/checkout?session_id={CHECKOUT_SESSION_ID}`,
  subscription_data: {
    metadata: { user_id: user.id, tier },
  },
});
```

`subscription_data.metadata.user_id` is the **only** link the webhook has back to the user
(`cloud/gateway/src/routes/webhook.ts:L37`) — a subscription created outside this flow (e.g. by
hand in the Stripe dashboard) carries no `user_id` and is skipped with a warning (`:L39-L42`).

Frontend: `com/src/routes/pricing.tsx` renders `plans` and navigates to `/checkout?tier=<id>`;
`com/src/routes/checkout.tsx:39-51` mounts `<EmbeddedCheckout>` with
`fetchClientSecret = () => createCheckout(tier).client_secret`; `com/src/lib/cloud.ts:164-176`
wraps `POST /api/billing/checkout` and `GET /api/billing/checkout/status`. After redirect,
`GET /api/billing/checkout/status?session_id=…` returns
`{ status, payment_status }` from `stripe.checkout.sessions.retrieve`
(`cloud/gateway/src/routes/billing.ts:L205-L216`).

### 4.4 Customer portal

`POST /api/billing/portal` (JWT) → `{ url }` from `stripe.billingPortal.sessions.create`, with
`return_url: BASE_URL` (`cloud/gateway/src/routes/billing.ts:L99-L109`). Note it **ignores any
request body** — the `return_url` some callers post is not used.

### 4.5 Webhook — the only place a tier actually changes

`POST /api/stripe/webhook` (mounted at `cloud/gateway/src/index.ts:33`) verifies the signature
with `STRIPE_WEBHOOK_SECRET` over the **raw body** and handles three events
(`cloud/gateway/src/routes/webhook.ts:L9-L110`):

| Event | Action |
|---|---|
| `customer.subscription.created` / `.updated` | `getTierByPriceId(priceId)` → `litellm.updateUserTier(userId, tier)` (rewrites the user's attrs **and every one of their keys'** budget windows/models/limits) → `ensureUserPod(userId, tier.pod)` (idempotent: create, wake, or **patch resources** — handles upgrades *and* downgrades) `:L33-L74` |
| `customer.subscription.deleted` | `litellm.updateUserTier(userId, TIERS.free)` → `deleteUserPod(userId)` — the whole `user-<id>` namespace is torn down; the user reverts to lazy provisioning `:L76-L103` |

Both LiteLLM and K8s failures are caught and logged, and the handler still returns
`{ received: true }` (`:L56-L58, L69-L72, L109`) — Stripe is never retried on a partial
failure, so a tier change that half-applied must be repaired manually (e.g. with
`resync-tier-budgets.ts`).

`updateUserTier` deliberately does **not** send `budget_limits` to `/user/update` — LiteLLM's
user table has no such column and the call 400s — so budgets are applied per-key
(`cloud/gateway/src/lib/litellm.ts:L56-L81`).

---

## 5. The 15% gateway markup

Revenue on tokens comes from a **flat 15% markup over the Azure base price**, baked into
LiteLLM's per-model cost table (LiteLLM multiplies tokens × these costs to produce the `spend`
that the budget windows are measured against).

- `MARKUP = 1.15`; `input_cost_per_token = inputPer1K / 1000 * MARKUP`
  (`cloud/scripts/generate-litellm-models.ts:L22-L23,L42-L49`).
- Base prices: `sdk/org/libs/cli/prices/azure.json` (per-1K USD; refreshed by
  `pnpm fetch-azure-prices` in `libs/cli`) — e.g. `DeepSeek-V4-Flash.inputPer1K = 0.00019`
  (`sdk/org/libs/cli/prices/azure.json:2-5`).
- The generator prints a `model_list:` block to paste into the ArgoCD-managed
  `devops/argocd/core/litellm.yaml`, which stays the deployed source of truth
  (`cloud/scripts/generate-litellm-models.ts:L10-L12,L63-L80`).

Check the math: `0.00019 / 1000 × 1.15 = 2.185e-7` → the deployed
`input_cost_per_token: 0.0000002185` for `DeepSeek-V4-Flash`
(`devops/argocd/core/litellm.yaml:14-23`). `gpt-5.5` additionally carries a
`cache_read_input_token_cost` (marked up the same way) from `cachedInputPer1K`
(`cloud/scripts/generate-litellm-models.ts:L75-L77`; `devops/argocd/core/litellm.yaml:46-56`).

`whisper-1` is registered **without** `model_info`, so it is billed per-minute from LiteLLM's
built-in `azure/whisper` cost map — i.e. the 15% markup does **not** apply to transcription
(`devops/argocd/core/litellm.yaml:69-79`).

> Correction: `Architecture.md:154`, `space/README.md:43` and `team/README.md:21` say **10%**
> markup ("Stripe AI Gateway"). The code says **15%** and there is no Stripe AI Gateway in the
> repo — LiteLLM does the metering. `com/README.md:27` and `com/src/routes/pricing.tsx:25`
> (15%) are correct.

---

## 6. Usage, budgets and the spend surfaces

There are no credits. "Usage" means *LiteLLM spend in USD* against the tier's rolling windows.

### `GET /api/billing/usage` (JWT)

Returns `{ tier, spend, budgets: [{duration, max_budget, spend|null}], models }`. `budgets` is
built from the **tier config** (so it is always populated) and the per-window `spend` is
best-effort — only filled if the LiteLLM image happens to expose `budget_limits[].spend`
(`cloud/gateway/src/routes/billing.ts:L115-L154`). On any LiteLLM error it degrades to a
free-tier shape rather than failing (`:L146-L153`).

### `GET /api/billing/budget` (JWT) — the real remaining-budget endpoint

LiteLLM does not expose per-window spend, and an **over-budget key 429s on every call including
reads** — exactly when you need the number. So the gateway computes it with the **master key**:

1. read the user's tier + `created_at` (`cloud/gateway/src/routes/billing.ts:L165-L172`);
2. for each window, compute the current period with `windowBounds(createdAt, now, nDays)` —
   windows are anchored to the user's **first day**, repeating every `nDays`, not to LiteLLM's
   calendar-aligned `reset_at` (`cloud/gateway/src/lib/budget-math.ts:L38-L56`);
3. pull `/user/daily/activity` (paginated, master key) into a `YYYY-MM-DD → spend` map
   (`cloud/gateway/src/lib/litellm.ts:L103-L131`);
4. `sumSpend()` over the window and `remainingPct()` clamped to 0–100
   (`cloud/gateway/src/lib/budget-math.ts:L58-L79`).

Response: `{ windows: [{ duration, label, remainingPct, resetsAt }] }`, sorted shortest window
first, labels `Today` / `Week` / `Month`
(`cloud/gateway/src/routes/billing.ts:L188-L197`; `cloud/gateway/src/lib/budget-math.ts:L12-L17`).
Failure → `502 { error: "budget unavailable" }` (`:L198-L201`).

### The pod relay and the chat indicator

The compute pod can't compute this itself (it only holds the user's key), so
`GET /api/budget` on the pod forwards the caller's `Authorization` header to
`${LMTHING_GATEWAY_URL}/api/billing/budget`, returning **404** when there is no auth or no
gateway (local/off-cloud pods), which the UI reads as "hide"
(`sdk/org/libs/cli/src/server/routes/budget.ts:L17-L39`; route registered at
`sdk/org/libs/cli/src/server/serve.ts:140`; `LMTHING_GATEWAY_URL` injected into `user-env` at
`cloud/gateway/src/lib/compute.ts:L348-L350`).

`BudgetWindows` polls that endpoint every 30s (and on every session-cost change) and renders
the remaining percentages under the composer; **any window at exactly 0% sets `budgetBlocked`**,
which disables the composer with "Budget reached — try again after it resets" and short-circuits
send (`sdk/org/libs/ui/src/chat/app/BudgetWindows.tsx:L12-L55`;
`sdk/org/libs/ui/src/chat/app/Composer.tsx:50,66,372`;
`sdk/org/libs/ui/src/chat/app/ChatView.tsx:119`).

### `/api/auth/me` and `/api/keys`

`GET /api/auth/me` echoes `{ user_id, email, tier, budget_limits, spend }` from LiteLLM
(`cloud/gateway/src/routes/auth.ts:L186-L205`). `POST /api/keys` mints an **additional** key
that inherits the user's *current* tier (models + budget windows + tpm/rpm)
(`cloud/gateway/src/routes/keys.ts:L32-L59`); `GET /api/keys` lists them with `spend` and
`max_budget` (`:L12-L29`). Every key carries its own budget windows — which is why
`resync-tier-budgets.ts` iterates **all** of a user's keys
(`cloud/scripts/resync-tier-budgets.ts:L9-L13`).

---

## 7. Operating the tiers

- **Changing a tier's numbers** in `tiers.ts` does **not** touch existing users: budget windows
  are only (re)written on provisioning and on a Stripe tier change. Backfill with
  `LITELLM_MASTER_KEY=… APPLY=1 pnpm --filter @lmthing/cloud litellm:resync-budgets`
  (dry-run by default; `TIER=free` restricts it; it imports `TIERS` from the gateway lib so it
  cannot drift) (`cloud/scripts/resync-tier-budgets.ts:L1-L33,L107-L123`).
- **Changing prices/markup**: edit `azure.json` (or re-fetch), run
  `pnpm litellm:generate-models`, paste into `devops/argocd/core/litellm.yaml`, let ArgoCD sync
  (`cloud/scripts/generate-litellm-models.ts:L10-L15`; `devops/argocd/core/litellm.yaml:8-12`).
- **Pods created between upgrades keep a free-tier key.** `getLiteLLMKey()` — called from the
  pod-ensure path — always generates the `compute-<userId>` key with **`TIERS.free`**
  (`cloud/gateway/src/lib/compute.ts:L312-L334`). That key only picks up the paid windows the
  next time `updateUserTier()` runs (i.e. on the next Stripe subscription event) or when
  `resync-tier-budgets.ts` is run. LiteLLM never re-reveals a key's secret, so the function
  falls back to the value already stored in `user-env` when the alias exists (`:L325-L333`).
- **Adding a tier** → [../contributing/add-a-tier.md](../contributing/add-a-tier.md).

---

## 8. Known drift between code and callers

1. **`cloud/CLAUDE.md:101-104`** — "requires pro/max tier" on `/api/compute/status|env`. False;
   see §3. All tiers get compute.
2. **Per-tier rate limits** in `cloud/CLAUDE.md:183-188`, `.claude/skills/add-tier.md` and
   `com/src/config/plans.ts:23-68` — the gateway stamps 1M tpm / 5K rpm on *every* tier.
3. **"All 4 models"** (`cloud/CLAUDE.md:178`, `com/src/config/plans.ts:15`) — five chat models
   + `whisper-1`.
4. **`com/src/routes/billing/usage.tsx:6-13,50-55`** still reads the *old* flat
   `{ max_budget, budget_duration, budget_reset_at }` shape; `/api/billing/usage` now returns a
   `budgets[]` array (`cloud/gateway/src/routes/billing.ts:L140-L145`) — so the page renders
   `$x / $undefined` and a `NaN%` bar.
5. **`sdk/org/libs/ui/src/elements/settings/billing/index.tsx:20-21`** destructures
   `{ portal_url }` from `POST /api/billing/portal`, but the gateway returns `{ url }`
   (`cloud/gateway/src/routes/billing.ts:L108`) → `window.location.href = undefined`. The `com`
   copy is correct: `const { url } = await billingPortal()`
   (`com/src/routes/billing.tsx:25`).
6. **`.claude/skills/add-tier.md`** points at paths that no longer exist: `cloud/k8s/gateway.yaml`
   + `cloud/k8s/.env.secrets.example` (the manifest is `devops/argocd/core/gateway.yaml`; there is
   no `cloud/k8s/` directory) and the tier knowledge base under
   `sdk/libs/thing/spaces/space-ecosystem/knowledge/billing-context/` (no `billing-context`
   directory exists anywhere under `sdk/`).

> UNVERIFIED: whether the Stripe products/prices, the `STRIPE_PRICE_*` secret values, and the
> webhook endpoint actually exist in the live Stripe account — that is account state, not repo
> state (searched `cloud/scripts/create-stripe-products.ts`, `devops/argocd/core/gateway.yaml`,
> `cloud/.env.example`).

> UNVERIFIED: LiteLLM's *internal* enforcement semantics for `budget_limits`, `tpm_limit`,
> `rpm_limit` and the `azure/whisper` per-minute cost map — these live in the upstream LiteLLM
> image, not in this repo (searched `devops/argocd/core/litellm.yaml`, `cloud/gateway/src/lib/litellm.ts`).
> Everything here describes what the gateway *sends*; the "rejected once any window is exhausted"
> behaviour is asserted by `cloud/gateway/src/lib/tiers.ts:L71-L75` and mirrored client-side by
> `BudgetWindows`.
