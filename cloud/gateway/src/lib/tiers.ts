// Adding a new tier? See CLAUDE.md § "Adding a New Tier" for the full checklist.
// This file is one of ~10 places that need updating across the monorepo.

export interface Tier {
  name: string;
  stripePriceId: string | null;
  budget: number;
  budgetDuration: string;
  models: string[];
  tpmLimit: number;
  rpmLimit: number;
  /** Whether this tier includes a dedicated compute pod */
  compute: boolean;
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
    compute: false,
  },
  starter: {
    name: "Starter",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || "",
    budget: 5.0,
    budgetDuration: "30d",
    models: ["gpt-5.4-nano"],
    tpmLimit: 25_000,
    rpmLimit: 150,
    compute: false,
  },
  basic: {
    name: "Basic",
    stripePriceId: process.env.STRIPE_PRICE_BASIC || "",
    budget: 10.0,
    budgetDuration: "30d",
    models: ["gpt-5.4-nano"],
    tpmLimit: 50_000,
    rpmLimit: 300,
    compute: false,
  },
  pro: {
    name: "Pro",
    stripePriceId: process.env.STRIPE_PRICE_PRO || "",
    budget: 20.0,
    budgetDuration: "30d",
    models: ["gpt-5.4-nano"],
    tpmLimit: 100_000,
    rpmLimit: 1_000,
    compute: true,
  },
  max: {
    name: "Max",
    stripePriceId: process.env.STRIPE_PRICE_MAX || "",
    budget: 100.0,
    budgetDuration: "30d",
    models: [],
    tpmLimit: 1_000_000,
    rpmLimit: 5_000,
    compute: true,
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
