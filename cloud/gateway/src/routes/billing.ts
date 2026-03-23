import { Hono } from "hono";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import { TIERS } from "../lib/tiers.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Env } from "../types.js";
import type { AuthUser } from "../middleware/auth.js";

const BASE_URL = process.env.BASE_URL!;

const billing = new Hono<Env>();

billing.use("*", authMiddleware);

// Ensure user has a Stripe customer — create one if missing
async function ensureStripeCustomer(user: AuthUser): Promise<string> {
  // Check LiteLLM metadata first
  try {
    const info = await litellm.getUserInfo(user.id);
    const existing = info.user_info?.metadata?.stripe_customer_id;
    if (existing) return existing;
  } catch {
    // user might not exist in LiteLLM yet
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { user_id: user.id },
  });

  // Store in LiteLLM user metadata
  try {
    await litellm.createUser(user.id, TIERS.free, {
      stripe_customer_id: customer.id,
    });
  } catch {
    // User might already exist — update metadata instead
    try {
      const info = await litellm.getUserInfo(user.id);
      const existingMeta = info.user_info?.metadata || {};
      await litellm.request("/user/update", "POST", {
        user_id: user.id,
        metadata: { ...existingMeta, stripe_customer_id: customer.id },
      });
    } catch {
      // best effort
    }
  }

  return customer.id;
}

// Create a Stripe Checkout session for tier upgrade
billing.post("/checkout", async (c) => {
  const user = c.get("user");
  const { tier, return_url } = await c.req.json<{
    tier: string;
    return_url?: string;
  }>();

  const targetTier = TIERS[tier];
  if (!targetTier || !targetTier.stripePriceId) {
    return c.json({ error: `Invalid tier: ${tier}` }, 400);
  }

  const customerId = await ensureStripeCustomer(user);

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

  return c.json({ client_secret: session.client_secret });
});

// Create a Stripe Customer Portal session
billing.post("/portal", async (c) => {
  const user = c.get("user");
  const customerId = await ensureStripeCustomer(user);

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

// GET /checkout/status — check checkout session result
billing.get("/checkout/status", async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json({ error: "session_id required" }, 400);
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return c.json({
    status: session.status,
    payment_status: session.payment_status,
  });
});

export default billing;
