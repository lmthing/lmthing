/**
 * Create Stripe products and prices for LMThing tiers.
 * Idempotent — skips creation if prices with matching lookup_keys already exist.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-stripe-products.ts
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface TierConfig {
  lookupKey: string;
  amount: number;
  label: string;
}

const TIERS: TierConfig[] = [
  { lookupKey: "lmthing_basic", amount: 1000, label: "Basic $10/month" },
  { lookupKey: "lmthing_pro", amount: 2000, label: "Pro $20/month" },
  { lookupKey: "lmthing_max", amount: 10000, label: "Max $100/month" },
];

async function main() {
  console.log("LMThing API Gateway — Stripe Setup\n");

  // Check for existing prices by lookup_key
  const existingPrices = await stripe.prices.list({ lookup_keys: TIERS.map((t) => t.lookupKey) });
  const existingKeys = new Set(existingPrices.data.map((p) => p.lookup_key));

  if (existingKeys.size === TIERS.length) {
    console.log("All prices already exist:\n");
    for (const price of existingPrices.data) {
      const tier = TIERS.find((t) => t.lookupKey === price.lookup_key)!;
      console.log(`  ${tier.label}: ${price.id}`);
    }
    console.log("\n── .env.secrets values ──\n");
    for (const price of existingPrices.data) {
      const envKey = `STRIPE_PRICE_${price.lookup_key!.replace("lmthing_", "").toUpperCase()}`;
      console.log(`${envKey}=${price.id}`);
    }
    return;
  }

  // Find or create product
  const products = await stripe.products.list({ limit: 100 });
  let product = products.data.find((p) => p.name === "LMThing API Gateway");

  if (!product) {
    product = await stripe.products.create({
      name: "LMThing API Gateway",
      description: "LLM API access with tiered pricing and 10% token markup",
    });
    console.log(`Created product: ${product.id}`);
  } else {
    console.log(`Product exists: ${product.id}`);
  }

  // Create missing prices
  const priceIds: Record<string, string> = {};

  for (const tier of TIERS) {
    if (existingKeys.has(tier.lookupKey)) {
      const existing = existingPrices.data.find((p) => p.lookup_key === tier.lookupKey)!;
      console.log(`${tier.label}: ${existing.id} (exists)`);
      priceIds[tier.lookupKey] = existing.id;
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.amount,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { tier: tier.lookupKey.replace("lmthing_", "") },
        lookup_key: tier.lookupKey,
      });
      console.log(`${tier.label}: ${price.id} (created)`);
      priceIds[tier.lookupKey] = price.id;
    }
  }

  console.log("\n── Add these to your .env.secrets ──\n");
  console.log(`STRIPE_PRICE_BASIC=${priceIds.lmthing_basic}`);
  console.log(`STRIPE_PRICE_PRO=${priceIds.lmthing_pro}`);
  console.log(`STRIPE_PRICE_MAX=${priceIds.lmthing_max}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
