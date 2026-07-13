# Adding a pricing tier

A **tier** is one entry in the `TIERS` record in `cloud/gateway/src/lib/tiers.ts` — a bundle of
LiteLLM spend caps, a model allowlist, rate limits, K8s pod sizing and a cron policy, optionally
sold as a Stripe subscription (`cloud/gateway/src/lib/tiers.ts#Tier`). It is genuinely
cross-cutting: the gateway, the Stripe account, the Ansible vault, the ArgoCD manifest and the
marketing pricing page all have to agree.

Read [../cloud/billing-and-tiers.md](../cloud/billing-and-tiers.md) first — it is the reference
(what each field *does*, where it is enforced, the Stripe flow). This page is the **procedure**.

There is **no rate-limit ladder**: all four tiers are stamped at the same `tpmLimit: 1_000_000` /
`rpmLimit: 5_000` (`cloud/gateway/src/lib/tiers.ts:100-101`, `:129-130`, `:143-144`, `:157-158`);
only the budget windows, the model list and the pod/cron policy differ. The gateway's K8s manifest
is `devops/argocd/core/gateway.yaml` (there is no `cloud/k8s/` directory), and there is no "tier
knowledge base" anywhere in the repo.

---

## 0. What you are actually adding

One object literal. Everything else in the gateway iterates `TIERS` or resolves a tier by
name/price id, so **no route code changes** (`getTierByPriceId`/`getTierByName`,
`cloud/gateway/src/lib/tiers.ts:164-175`; consumers: `cloud/gateway/src/routes/billing.ts:70`,
`cloud/gateway/src/routes/keys.ts:45`, `cloud/gateway/src/routes/compute.ts:102`,
`cloud/gateway/src/routes/webhook.ts:44`, `cloud/gateway/src/lib/compute.ts:437-447`).

---

## 1. Define the tier — `cloud/gateway/src/lib/tiers.ts`

Add a key to `TIERS` (`cloud/gateway/src/lib/tiers.ts#TIERS`). Every field of `Tier` is
**required** — TypeScript is the first gate, and `cloud/gateway/Dockerfile:7` runs `npx tsc`, so a
malformed tier fails the CI image build (`.github/workflows/build-images.yml:169`).

```ts
export interface Tier {
  name: string;
  stripePriceId: string | null;
  budgetLimits: BudgetWindow[];
  models: string[];
  tpmLimit: number;
  rpmLimit: number;
  pod: PodConfig;
  /** Externalized-cron policy (min interval + max jobs) for this tier. */
  cron: CronPolicy;
}
```
— `cloud/gateway/src/lib/tiers.ts#Tier`. Copy the shape of an existing tier, e.g. `pro`:

```ts
  pro: {
    name: "Pro",
    stripePriceId: process.env.STRIPE_PRICE_PRO || "",
    budgetLimits: [
      { duration: "1d", maxBudget: 3 },
      { duration: "7d", maxBudget: 10 },
      { duration: "30d", maxBudget: 20 },
    ],
    models: [...TIER_MODELS],
    tpmLimit: 1_000_000,
    rpmLimit: 5_000,
    pod: { cpu: "500m", mem: "1Gi", idleTtlMinutes: 60, maxSessions: 5 },
    cron: { minIntervalMs: 5 * 60_000, maxJobs: 100 },
  },
```
— `cloud/gateway/src/lib/tiers.ts:134-147`.

Field by field:

| Field | Rules | Code |
|---|---|---|
| **key** (`pro`) | This is the tier's identity everywhere: the `tier` string in `POST /api/billing/checkout` (`TIERS[tier]`), the `metadata.tier` LiteLLM writes back, and the `plan.id` on the pricing page. | `cloud/gateway/src/routes/billing.ts:70`; `cloud/gateway/src/lib/tiers.ts#getTierByName` |
| **`name`** | ⚠️ **`name.toLowerCase()` must equal the record key.** LiteLLM stores `metadata: { tier: tier.name.toLowerCase() }` (`createUser`/`generateKey`/`updateUserTier`), and every read path feeds that string back into `getTierByName()` → `TIERS[name]`. A `name: "Team Plus"` under key `team` resolves to `null` forever after and the user silently falls back to `free`. | `cloud/gateway/src/lib/litellm.ts#createUser`, `:52`, `:67`; `cloud/gateway/src/lib/tiers.ts#getTierByName`; `cloud/gateway/src/routes/compute.ts:27-35` |
| **`stripePriceId`** | `null` for a free tier; otherwise `process.env.STRIPE_PRICE_<TIER> \|\| ""`. `getTierByPriceId()` skips falsy ids, and `/api/billing/checkout` 400s on a tier without one. | `cloud/gateway/src/lib/tiers.ts:122`, `:164-171`; `cloud/gateway/src/routes/billing.ts:70-73` |
| **`budgetLimits`** | Array of `{ duration, maxBudget }` rolling windows (LiteLLM duration strings, `"1d"`/`"7d"`/`"30d"`). `toBudgetLimits()` maps them onto the LiteLLM payload; a request is rejected once **any** window is exhausted. `monthlyBudget()` reads the `30d` window as the headline. | `cloud/gateway/src/lib/tiers.ts#BudgetWindow`, `:71-76`, `:179-193` |
| **`models`** | Normally `[...TIER_MODELS]` — `[...ENABLED_MODELS, ...TRANSCRIBE_MODELS]`. A model missing from a key's allowlist gets a LiteLLM `key_model_access_denied` 403. Adding a **model** (not a tier) is a different recipe → [add-a-provider.md](./add-a-provider.md#a-add-a-model-to-the-managed-lmthingcloud-provider-litellm). | `cloud/gateway/src/lib/tiers.ts:7-25` |
| **`tpmLimit` / `rpmLimit`** | Stamped on the LiteLLM user *and* key. Today all four tiers use `1_000_000` / `5_000`; if you introduce a genuinely lower tier, know that a stale/low tpm 429s THING's large system prompt on the first turn (that is why `resync-tier-budgets.ts` re-applies them). | `cloud/gateway/src/lib/litellm.ts#createUser`, `:49-50`; `cloud/scripts/resync-tier-budgets.ts:169-174` |
| **`pod`** | `PodConfig` → the K8s Deployment. Omit `cpuRequest`/`memRequest` to keep the pod **Guaranteed** (`request == limit`); set them below the limits for a **Burstable**, densely-packed pod (what `free` does). `idleTtlMinutes` → `IDLE_TTL_MINUTES`, `maxSessions` → `MAX_SESSIONS`. | `cloud/gateway/src/lib/tiers.ts#PodConfig`, `:109-116`; `cloud/gateway/src/lib/compute.ts:226-241` |
| **`cron`** | **Required — see below.** | `cloud/gateway/src/lib/tiers.ts#CronPolicy`, `:87` |

### `cron` is not optional — omitting it breaks cron for every user on the tier

`CronPolicy { minIntervalMs, maxJobs }` bounds how often the gateway's cron-wake tick may wake an
idle pod (`cloud/gateway/src/lib/tiers.ts:58-66`). `POST /api/compute/cron-manifest` — the route
the pod calls to publish its **entire** cron schedule — dereferences it unconditionally:

```ts
  const tierName = await resolveUserTier(userId);
  const tier = getTierByName(tierName) ?? getTierByName("free")!;
  const policy = tier.cron;
  …
    const everyMs = Math.max(everyMsRaw, policy.minIntervalMs);
    …
    if (jobs.length >= policy.maxJobs) break;
  …
    await replaceCronManifest(userId, jobs, policy.minIntervalMs);
```
— `cloud/gateway/src/routes/compute.ts:101-128`. With `cron` absent, `policy` is `undefined` and
the first property read throws a `TypeError`; the route never persists the manifest (the handler's
own `catch` turns the last one into `{ error: "cron-manifest failed" }`, 500 —
`cloud/gateway/src/routes/compute.ts:130-133`). The manifest is **replace-all**, so the user's cron
hooks stop firing entirely. `tsc` catches this (`cron: CronPolicy` is non-optional,
`cloud/gateway/src/lib/tiers.ts#Tier.cron`) — never silence it with a cast.

---

## 2. Create the Stripe price

Two equivalent paths; both are idempotent-ish and both **print the env-var lines you need next**.

**a. The TypeScript script** (preferred — same lookup keys as prod):

```ts
const TIERS: TierConfig[] = [
  { lookupKey: "lmthing_basic", amount: 1000, label: "Basic $10/month" },
  { lookupKey: "lmthing_pro", amount: 2000, label: "Pro $20/month" },
  { lookupKey: "lmthing_max", amount: 10000, label: "Max $100/month" },
];
```
— `cloud/scripts/create-stripe-products.ts#TIERS`. Add your `{ lookupKey: "lmthing_<tier>", amount:
<cents>, label }` row **and** the matching `console.log` line in the final block
(`cloud/scripts/create-stripe-products.ts:86-89`) — the script derives the env key from the lookup
key (`STRIPE_PRICE_${lookup_key.replace("lmthing_","").toUpperCase()}`,
`cloud/scripts/create-stripe-products.ts:44`), but the "add these to your .env.secrets" summary is
hand-written per tier. Run it:

```bash
STRIPE_SECRET_KEY=sk_live_xxx pnpm --filter @lmthing/cloud stripe:create-products
```
— `cloud/package.json:6`, usage banner `cloud/scripts/create-stripe-products.ts:9-11`.

**b. The bootstrap shell script** — `devops/ansible/scripts/setup/create-stripe-prices.sh` creates
the products/prices *and* registers the Stripe webhook endpoint, printing `vault_stripe_price_*`
lines ready to paste into `vault.yml` (`devops/ansible/scripts/setup/create-stripe-prices.sh:46-70`).
Add a `create_price "<Name>" <cents>` call and an `echo` line if you use this one.

---

## 3. Plumb `STRIPE_PRICE_<TIER>` through — four files

The gateway reads the price id from `process.env` at module load
(`cloud/gateway/src/lib/tiers.ts:122`, `:136`, `:150`), so the variable must exist in the pod. It
travels: **vault → k8s Secret → Deployment env**.

| # | File | What to add | Cite |
|---|---|---|---|
| 1 | `cloud/.env.example` | `STRIPE_PRICE_<TIER>=price_xxx` next to the existing three | `cloud/.env.example:19-21` |
| 2 | `devops/ansible/vault.yml.example` **and the real (encrypted) `devops/ansible/vault.yml`** | `vault_stripe_price_<tier>: price_xxx` (edit the real one with `make vault-edit` → `ansible-vault edit vault.yml`) | `devops/ansible/vault.yml.example:91-93`; `devops/Makefile:88-89` |
| 3 | `devops/ansible/roles/cloud_secrets/tasks/main.yml` | `STRIPE_PRICE_<TIER>: "{{ vault_stripe_price_<tier> }}"` in the `lmthing-secrets` `stringData` | `devops/ansible/roles/cloud_secrets/tasks/main.yml:37-39` |
| 4 | `devops/argocd/core/gateway.yaml` | an `env:` entry `secretKeyRef → lmthing-secrets / STRIPE_PRICE_<TIER>` | `devops/argocd/core/gateway.yaml:100-114` |

Miss #3 or #4 and `stripePriceId` falls back to `""` → `getTierByPriceId()` never matches the
Stripe webhook's price id → the subscription is paid but the tier never changes
(`cloud/gateway/src/lib/tiers.ts#getTierByPriceId`; `cloud/gateway/src/routes/webhook.ts:44-47` logs
`Unknown price_id`).

---

## 4. The pricing page — `com/src/config/plans.ts`

The `/pricing` route renders `plans` left-to-right and passes `plan.id` straight through to
checkout: `handleSubscribe(plan.id)` → `/checkout?tier=<id>` → `createCheckout(tier)` → `POST
/api/billing/checkout { tier }` → `TIERS[tier]` (`com/src/routes/pricing.tsx:13-19`, `:48`;
`com/src/lib/cloud.ts#createCheckout`; `cloud/gateway/src/routes/billing.ts:65-73`). So:

- **`plan.id` must be the `TIERS` key** — otherwise checkout 400s `Invalid tier: <id>`.
- Add the `Plan` object (`com/src/config/plans.ts#Plan` interface, `:16-70` the array). `highlighted:
  true` marks the recommended card (`com/src/config/plans.ts:55`).
- **The grid is hard-coded to four columns** — `className="grid gap-6 md:grid-cols-4"`
  (`com/src/routes/pricing.tsx:28`). A fifth plan needs that changed.
- The `features` bullets are free-text marketing copy, checked by nothing
  (`com/src/config/plans.ts:16-70`) — take the rate limits, budgets and model count for a new card
  from the code, i.e. from
  [../cloud/billing-and-tiers.md](../cloud/billing-and-tiers.md#2-the-tiers-verbatim-from-code).

Nothing else in the frontend hard-codes tier names: the in-app billing settings panel just opens the
Stripe customer portal (`sdk/org/libs/ui/src/elements/settings/billing/index.tsx#openBillingPortal`), and no
`/api/compute/*` route is tier-gated (`../cloud/billing-and-tiers.md`, §3 "What is NOT tier-gated").

---

## 5. Ship it

1. **Secrets first** (they are not in git): `make -C devops deploy-secrets` → runs the
   `cloud_secrets` role with `--tags secrets` (`devops/Makefile:76-77`;
   `devops/ansible/Makefile:54-55`; `devops/ansible/playbooks/services.yml:13`), recreating
   `lmthing-secrets` with the new key.
2. **Merge to `main`.** CI rebuilds the gateway image on any `cloud/gateway/**` change
   (`.github/workflows/build-images.yml:13`, `:169`) and commits the new tag into
   `devops/argocd/core/gateway.yaml`; the `lmthing-core` ArgoCD Application auto-syncs
   `devops/argocd/core/` with `prune`+`selfHeal` (`devops/argocd/apps/core.yaml:10-20`). The
   manifest change (the new `env:` entry) rolls the Deployment — **no manual `kubectl apply`**.
   If you changed *only* the Secret and not `gateway.yaml`, nothing restarts on its own:
   `kubectl rollout restart deploy/gateway -n lmthing`.
3. **Backfill existing users** if you changed an *existing* tier's numbers (budgets/models/rate
   limits are only written at provisioning time and on a Stripe tier change):

   ```bash
   kubectl -n lmthing port-forward svc/litellm 4000:4000 &
   LITELLM_MASTER_KEY=$(kubectl -n lmthing get secret lmthing-secrets \
       -o jsonpath='{.data.LITELLM_MASTER_KEY}' | base64 -d) \
     LITELLM_URL=http://127.0.0.1:4000 APPLY=1 \
     pnpm --filter @lmthing/cloud litellm:resync-budgets
   ```
   — `cloud/scripts/resync-tier-budgets.ts:23-30` (dry-run without `APPLY=1`; `TIER=<key>` narrows
   it). It imports `TIERS` from the gateway lib so it can't drift
   (`cloud/scripts/resync-tier-budgets.ts:33`) and re-applies budgets **and** models **and**
   tpm/rpm to every key a user holds (`:128-140`, `:162-174`).
4. **Verify** end to end: subscribe on `/pricing` → Stripe `customer.subscription.created` →
   `getTierByPriceId` → `updateUserTier` + `ensureUserPod(tier.pod)`
   (`cloud/gateway/src/routes/webhook.ts:44-72`); then `GET /api/billing/usage` should report the
   new `tier` and its `budgets[]` (`cloud/gateway/src/routes/billing.ts:136-145`).

---

## Checklist

| # | What | Where |
|---|---|---|
| 1 | The tier object — all 8 fields, **including `cron`**; `name.toLowerCase() === key` | `cloud/gateway/src/lib/tiers.ts#TIERS` |
| 2 | Stripe product/price + the env-line `console.log` | `cloud/scripts/create-stripe-products.ts#TIERS`, `:86-89` (or `devops/ansible/scripts/setup/create-stripe-prices.sh`) |
| 3 | `STRIPE_PRICE_<TIER>` placeholder | `cloud/.env.example:19-21` |
| 4 | `vault_stripe_price_<tier>` | `devops/ansible/vault.yml.example:91-93` + the encrypted `devops/ansible/vault.yml` |
| 5 | Secret `stringData` entry | `devops/ansible/roles/cloud_secrets/tasks/main.yml:37-39` |
| 6 | Deployment `env` entry (`secretKeyRef`) | `devops/argocd/core/gateway.yaml:100-114` |
| 7 | Pricing card (`plan.id` = `TIERS` key) + the `md:grid-cols-4` grid | `com/src/config/plans.ts:16-70`; `com/src/routes/pricing.tsx:28` |
| 8 | `make -C devops deploy-secrets`, merge (CI + ArgoCD do the rest), then `litellm:resync-budgets` if you changed existing numbers | `devops/Makefile:76-77`; `cloud/scripts/resync-tier-budgets.ts` |

**Not needed** (all handled dynamically): gateway route code, LiteLLM `model_list`, and the
studio/chat UI.

**Doc to update:** [../cloud/billing-and-tiers.md](../cloud/billing-and-tiers.md) — the tier table
(§2), the enforcement table (§3) and §7 "Operating the tiers" — in the **same change** as the code
([../SYNC.md](../SYNC.md)). If the tier changes anything a pod sees (pod sizing, cron floor, model
list), also check [../cli-api/README.md](../cli-api/README.md) and
[../cloud/litellm.md](../cloud/litellm.md).
