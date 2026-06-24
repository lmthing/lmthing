// Adding a new tier? See CLAUDE.md § "Adding a New Tier" for the full checklist.
// This file is one of ~10 places that need updating across the monorepo.

/** Per-tier compute pod sizing and idle behaviour. Every tier now gets a pod. */
export interface PodConfig {
  /** CPU request+limit (Kubernetes quantity string, e.g. "250m") */
  cpu: string;
  /** Memory request+limit (Kubernetes quantity string, e.g. "512Mi") */
  mem: string;
  /** Minutes of inactivity before the pod is scaled to 0 */
  idleTtlMinutes: number;
  /** Maximum concurrent agent sessions allowed in this pod */
  maxSessions: number;
}

export interface Tier {
  name: string;
  stripePriceId: string | null;
  budget: number;
  budgetDuration: string;
  models: string[];
  tpmLimit: number;
  rpmLimit: number;
  /**
   * Compute pod sizing for this tier.
   * All tiers now receive an ephemeral pod provisioned lazily on first use
   * and scaled to zero when idle (see idleTtlMinutes).
   */
  pod: PodConfig;
}

export const TIERS: Record<string, Tier> = {
  free: {
    name: "Free",
    stripePriceId: null,
    budget: 1.0,
    budgetDuration: "7d",
    models: ["gpt-5.4-nano"],
    tpmLimit: 10_000,
    rpmLimit: 60,
    pod: { cpu: "250m", mem: "512Mi", idleTtlMinutes: 15, maxSessions: 3 },
  },
  starter: {
    name: "Starter",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || "",
    budget: 5.0,
    budgetDuration: "30d",
    models: ["gpt-5.4-nano"],
    tpmLimit: 25_000,
    rpmLimit: 150,
    pod: { cpu: "250m", mem: "512Mi", idleTtlMinutes: 20, maxSessions: 2 },
  },
  basic: {
    name: "Basic",
    stripePriceId: process.env.STRIPE_PRICE_BASIC || "",
    budget: 10.0,
    budgetDuration: "30d",
    models: ["gpt-5.4-nano"],
    tpmLimit: 50_000,
    rpmLimit: 300,
    pod: { cpu: "500m", mem: "768Mi", idleTtlMinutes: 30, maxSessions: 3 },
  },
  pro: {
    name: "Pro",
    stripePriceId: process.env.STRIPE_PRICE_PRO || "",
    budget: 20.0,
    budgetDuration: "30d",
    models: ["gpt-5.4-nano"],
    tpmLimit: 100_000,
    rpmLimit: 1_000,
    pod: { cpu: "500m", mem: "1Gi", idleTtlMinutes: 60, maxSessions: 5 },
  },
  max: {
    name: "Max",
    stripePriceId: process.env.STRIPE_PRICE_MAX || "",
    budget: 100.0,
    budgetDuration: "30d",
    models: [],
    tpmLimit: 1_000_000,
    rpmLimit: 5_000,
    pod: { cpu: "1000m", mem: "2Gi", idleTtlMinutes: 120, maxSessions: 10 },
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
