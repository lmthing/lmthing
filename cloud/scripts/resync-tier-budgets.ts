/**
 * Re-apply each user's current tier budget windows to all of their LiteLLM keys.
 *
 * Budget windows (1d/7d/30d spend caps) are enforced at the KEY level and are only
 * (re)written when a user is provisioned or their tier changes (Stripe webhook).
 * So after you edit the numbers in `gateway/src/lib/tiers.ts`, existing users keep
 * their OLD caps until this backfill runs. Run it whenever you change a tier's
 * `budgetLimits`.
 *
 * A user may hold several keys (the auto-provisioned "default" key plus any created
 * via POST /api/keys) — every key carries its own budget windows, so this iterates
 * ALL of a user's keys, not just the first.
 *
 * Tier definitions are imported from the gateway lib so this never drifts from what
 * the deployed gateway enforces.
 *
 * Usage (dry run — prints what would change, writes nothing):
 *   LITELLM_MASTER_KEY=sk-... LITELLM_URL=http://litellm:4000 \
 *     tsx scripts/resync-tier-budgets.ts
 *
 * Apply for real:                          APPLY=1  tsx scripts/resync-tier-budgets.ts
 * Restrict to one tier:                    TIER=free tsx scripts/resync-tier-budgets.ts
 *
 * Against PRODUCTION, LiteLLM is in-cluster. Port-forward it and pass the master key
 * from the k8s secret, then run this script locally with tsx:
 *   kubectl -n lmthing port-forward svc/litellm 4000:4000 &
 *   LITELLM_MASTER_KEY=$(kubectl -n lmthing get secret lmthing-secrets \
 *       -o jsonpath='{.data.LITELLM_MASTER_KEY}' | base64 -d) \
 *     LITELLM_URL=http://127.0.0.1:4000 APPLY=1 \
 *     pnpm --filter @lmthing/cloud litellm:resync-budgets
 */

import { TIERS, toBudgetLimits, type Tier } from "../gateway/src/lib/tiers.js";

const LITELLM_URL = process.env.LITELLM_URL || "http://litellm:4000";
const MASTER_KEY = process.env.LITELLM_MASTER_KEY || "";
const APPLY = process.env.APPLY === "1";
const TIER_FILTER = process.env.TIER?.toLowerCase();

if (!MASTER_KEY) {
  console.error("LITELLM_MASTER_KEY is required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${MASTER_KEY}`,
  "Content-Type": "application/json",
};

async function api<T = any>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${LITELLM_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} — ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

interface LiteLLMUser {
  user_id: string;
  metadata?: { tier?: string } | null;
}

/** Enumerate every LiteLLM user, following pagination. */
async function allUsers(): Promise<LiteLLMUser[]> {
  const out: LiteLLMUser[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 500; page++) {
    const j = await api<{
      users?: LiteLLMUser[];
      data?: LiteLLMUser[];
      total_pages?: number;
      metadata?: { total_pages?: number };
    }>(`/user/list?page=${page}&page_size=${pageSize}`, "GET");
    const batch = j.users || j.data || [];
    out.push(...batch);
    const totalPages = j.total_pages ?? j.metadata?.total_pages;
    if (totalPages ? page >= totalPages : batch.length < pageSize) break;
  }
  return out;
}

interface LiteLLMKey {
  token: string;
  budget_limits?: unknown;
}

async function keysFor(userId: string): Promise<LiteLLMKey[]> {
  const j = await api<{ keys?: LiteLLMKey[] }>(
    `/key/list?user_id=${encodeURIComponent(userId)}&return_full_object=true`,
    "GET",
  );
  return j.keys || [];
}

async function main() {
  const users = await allUsers();
  const targets = users.filter((u) => {
    const tier = (u.metadata?.tier || "free").toLowerCase();
    if (TIER_FILTER && tier !== TIER_FILTER) return false;
    return TIERS[tier] != null;
  });

  console.log(
    `users: ${users.length} | targeted: ${targets.length}` +
      (TIER_FILTER ? ` (tier=${TIER_FILTER})` : "") +
      ` | APPLY=${APPLY}`,
  );

  let keysSeen = 0;
  let keysUpdated = 0;
  let errors = 0;

  for (const u of targets) {
    const tierName = (u.metadata?.tier || "free").toLowerCase();
    const tier: Tier = TIERS[tierName];
    const budgetLimits = toBudgetLimits(tier);

    let keys: LiteLLMKey[];
    try {
      keys = await keysFor(u.user_id);
    } catch (e) {
      console.error(`  ! list keys ${u.user_id}: ${(e as Error).message}`);
      errors++;
      continue;
    }

    for (const key of keys) {
      keysSeen++;
      if (!key.token) continue;
      const short = String(key.token).slice(0, 12);
      if (!APPLY) {
        console.log(
          `  [dry] ${u.user_id} (${tierName}) key=${short}… → ${JSON.stringify(budgetLimits)}`,
        );
        continue;
      }
      try {
        await api("/key/update", "POST", {
          key: key.token,
          budget_limits: budgetLimits,
          // Also re-apply the model allowlist so keys minted before a model was
          // added (e.g. whisper-1 for transcription) gain access without a
          // tier change — otherwise LiteLLM 403s "key_model_access_denied".
          ...(tier.models.length > 0 ? { models: tier.models } : {}),
        });
        keysUpdated++;
      } catch (e) {
        console.error(`  ! update ${u.user_id} ${short}…: ${(e as Error).message}`);
        errors++;
      }
    }
  }

  console.log(
    `\nkeys seen: ${keysSeen} | keys updated: ${keysUpdated} | errors: ${errors}`,
  );
  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
