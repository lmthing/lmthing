// Adding a new tier? See org/docs/contributing/add-a-tier.md for the full checklist.
// This file is one of ~10 places that need updating across the monorepo.

/** The models enabled on the lmthing.cloud provider. Every tier gets all of them;
 *  tiers differ only by their budget windows. These names match the LiteLLM
 *  `model_name`s in devops/argocd/core/litellm.yaml. */
export const ENABLED_MODELS = [
  "DeepSeek-V4-Flash",
  "DeepSeek-V4-Pro",
  "Kimi-K2.6",
  "gpt-5.5",
  // Cheap vision-capable model — the system-vision space agent analyzes images
  // on this (delegated from THING); also usable directly as a low-cost model.
  "gpt-5.4-mini",
] as const;

/** Transcription models every tier's key may call (audio → text for the chat
 *  vision/audio feature). Kept separate from ENABLED_MODELS so chat-model logic
 *  (pricing/model lists) stays chat-only; these must exist in litellm.yaml's
 *  model_list. A user key's `models` must include these or LiteLLM 403s
 *  ("key_model_access_denied") on /audio/transcriptions. */
export const TRANSCRIBE_MODELS = ["whisper-1"] as const;

/** The full model allowlist stamped onto each tier's LiteLLM key. */
export const TIER_MODELS = [...ENABLED_MODELS, ...TRANSCRIBE_MODELS];

/** One LiteLLM budget window: a spend cap that resets on its own cadence.
 *  `duration` uses LiteLLM's format ("1d", "7d", "30d"). */
export interface BudgetWindow {
  /** LiteLLM budget_duration string, e.g. "1d", "7d", "30d". */
  duration: string;
  /** Max USD spend allowed within this rolling window. */
  maxBudget: number;
}

/** Per-tier compute pod sizing and idle behaviour. Every tier now gets a pod. */
export interface PodConfig {
  /** CPU LIMIT (Kubernetes quantity string, e.g. "250m"). Also the request when
   *  `cpuRequest` is omitted (Guaranteed QoS). */
  cpu: string;
  /** Memory LIMIT (Kubernetes quantity string, e.g. "512Mi"). Also the request
   *  when `memRequest` is omitted (Guaranteed QoS). */
  mem: string;
  /** CPU request. When set below `cpu`, the pod is **Burstable** — the scheduler
   *  packs by this smaller request, enabling overcommit of mostly-idle pods.
   *  Omit on paid tiers to keep them Guaranteed (`request == limit`). */
  cpuRequest?: string;
  /** Memory request. When set below `mem`, the pod is **Burstable**. Omit to keep
   *  Guaranteed. The in-pod memory watchdog turns limit-pressure into graceful,
   *  recoverable session eviction (never an OOMKill). */
  memRequest?: string;
  /** Minutes of inactivity before the pod is scaled to 0 */
  idleTtlMinutes: number;
  /** Maximum concurrent agent sessions allowed in this pod */
  maxSessions: number;
}

/** Per-tier policy for externalized (gateway-driven) cron scheduling. Bounds how
 *  often a free pod is woken and how many jobs it can register. */
export interface CronPolicy {
  /** Minimum interval (ms) a cron hook may fire at. Shorter schedules published by
   *  a pod are clamped UP to this floor (free-tier throttling of idle-pod wakes). */
  minIntervalMs: number;
  /** Maximum cron jobs accepted per user; excess jobs in a manifest are dropped. */
  maxJobs: number;
}

export interface Tier {
  name: string;
  stripePriceId: string | null;
  /**
   * The budget windows applied to every user/key on this tier. Each window is an
   * independent rolling spend cap (LiteLLM "multiple budget windows"). A request is
   * rejected once ANY window is exhausted.
   */
  budgetLimits: BudgetWindow[];
  models: string[];
  tpmLimit: number;
  rpmLimit: number;
  /**
   * Compute pod sizing for this tier.
   * All tiers now receive an ephemeral pod provisioned lazily on first use
   * and scaled to zero when idle (see idleTtlMinutes).
   */
  pod: PodConfig;
  /** Externalized-cron policy (min interval + max jobs) for this tier. */
  cron: CronPolicy;
}

export const TIERS: Record<string, Tier> = {
  free: {
    name: "Free",
    stripePriceId: null,
    budgetLimits: [
      { duration: "1d", maxBudget: 10 },
      { duration: "7d", maxBudget: 50 },
      { duration: "30d", maxBudget: 150 },
    ],
    models: [...TIER_MODELS],
    tpmLimit: 1_000_000,
    rpmLimit: 5_000,
    // Burstable: the scheduler packs by the small requests (memRequest is the
    // binding constraint at ~110 pods/node), while the limits cap a busy pod. The
    // in-pod memory watchdog sheds idle sessions before the limit OOMKills.
    // CPU limit is intentionally HIGH (1500m) while the request stays tiny (50m):
    // cold-boot is single-threaded-Node CPU-bound, so letting a waking pod burst
    // into the node's idle cores cuts wake time ~linearly. QoS stays Burstable and
    // packing density is unchanged (governed by the 50m request), so this is free.
    pod: {
      cpu: "1500m",
      mem: "512Mi",
      cpuRequest: "50m",
      memRequest: "256Mi",
      idleTtlMinutes: 15,
      maxSessions: 3,
    },
    // 60-min floor bounds how often an idle free pod is woken for cron.
    cron: { minIntervalMs: 60 * 60_000, maxJobs: 20 },
  },
  basic: {
    name: "Basic",
    stripePriceId: process.env.STRIPE_PRICE_BASIC || "",
    budgetLimits: [
      { duration: "1d", maxBudget: 1 },
      { duration: "7d", maxBudget: 4 },
      { duration: "30d", maxBudget: 10 },
    ],
    models: [...TIER_MODELS],
    tpmLimit: 1_000_000,
    rpmLimit: 5_000,
    pod: { cpu: "500m", mem: "768Mi", idleTtlMinutes: 30, maxSessions: 3 },
    cron: { minIntervalMs: 15 * 60_000, maxJobs: 50 },
  },
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
  max: {
    name: "Max",
    stripePriceId: process.env.STRIPE_PRICE_MAX || "",
    budgetLimits: [
      { duration: "1d", maxBudget: 10 },
      { duration: "7d", maxBudget: 30 },
      { duration: "30d", maxBudget: 100 },
    ],
    models: [...TIER_MODELS],
    tpmLimit: 1_000_000,
    rpmLimit: 5_000,
    pod: { cpu: "1000m", mem: "2Gi", idleTtlMinutes: 120, maxSessions: 10 },
    cron: { minIntervalMs: 5 * 60_000, maxJobs: 200 },
  },
};

export function getTierByPriceId(priceId: string): [string, Tier] | null {
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.stripePriceId && tier.stripePriceId === priceId) {
      return [key, tier];
    }
  }
  return null;
}

export function getTierByName(name: string): Tier | null {
  return TIERS[name] || null;
}

/** The 30-day window's cap — the coarse "monthly budget" headline for a tier.
 *  Falls back to the largest configured window if no 30d window exists. */
export function monthlyBudget(tier: Tier): number {
  const monthly = tier.budgetLimits.find((b) => b.duration === "30d");
  if (monthly) return monthly.maxBudget;
  return tier.budgetLimits.reduce((max, b) => Math.max(max, b.maxBudget), 0);
}

/** Map a tier's budget windows to the LiteLLM `budget_limits` payload shape. */
export function toBudgetLimits(
  tier: Tier,
): { budget_duration: string; max_budget: number }[] {
  return tier.budgetLimits.map((b) => ({
    budget_duration: b.duration,
    max_budget: b.maxBudget,
  }));
}
