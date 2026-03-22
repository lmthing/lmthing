import { Hono } from "hono";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import { TIERS } from "../lib/tiers.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Env } from "../types.js";

const BASE_URL = process.env.BASE_URL!;

const billing = new Hono<Env>();

billing.use("*", authMiddleware);

// Create a Stripe Checkout session for tier upgrade
billing.post("/checkout", async (c) => {
  const user = c.get("user");
  const { tier, success_url, cancel_url } = await c.req.json<{
    tier: string;
    success_url?: string;
    cancel_url?: string;
  }>();

  const targetTier = TIERS[tier];
  if (!targetTier || !targetTier.stripePriceId) {
    return c.json({ error: `Invalid tier: ${tier}` }, 400);
  }

  // Look up Stripe customer ID from LiteLLM metadata
  let customerId: string | undefined;
  try {
    const info = await litellm.getUserInfo(user.id);
    customerId = info.user_info?.metadata?.stripe_customer_id;
  } catch {
    // no customer yet
  }

  if (!customerId) {
    return c.json({ error: "No billing account. Register first." }, 400);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: targetTier.stripePriceId, quantity: 1 }],
    success_url: success_url || `${BASE_URL}/api/billing/success`,
    cancel_url: cancel_url || `${BASE_URL}/api/billing/cancel`,
    subscription_data: {
      metadata: { user_id: user.id, tier },
    },
  });

  return c.json({ url: session.url });
});

// Create a Stripe Customer Portal session
billing.post("/portal", async (c) => {
  const user = c.get("user");

  let customerId: string | undefined;
  try {
    const info = await litellm.getUserInfo(user.id);
    customerId = info.user_info?.metadata?.stripe_customer_id;
  } catch {
    // no customer yet
  }

  if (!customerId) {
    return c.json({ error: "No billing account" }, 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: BASE_URL,
  });

  return c.json({ url: session.url });
});

// Get current usage and budget
billing.get("/usage", async (c) => {
  const user = c.get("user");

  try {
    const info = await litellm.getUserInfo(user.id);
    const userInfo = info.user_info || {};

    return c.json({
      tier: userInfo.metadata?.tier || "free",
      spend: userInfo.spend || 0,
      max_budget: userInfo.max_budget || 1,
      budget_duration: userInfo.budget_duration || "7d",
      budget_reset_at: userInfo.budget_reset_at,
      models: userInfo.models || TIERS.free.models,
    });
  } catch {
    return c.json({
      tier: "free",
      spend: 0,
      max_budget: 1,
      budget_duration: "7d",
      models: TIERS.free.models,
    });
  }
});

// Simple success/cancel pages
billing.get("/success", (c) =>
  c.html(
    "<html><body><h1>Subscription activated!</h1><p>Your API keys have been upgraded. You can close this page.</p></body></html>",
  ),
);

billing.get("/cancel", (c) =>
  c.html(
    "<html><body><h1>Checkout cancelled</h1><p>No changes were made.</p></body></html>",
  ),
);

export default billing;
