import { Hono } from "hono";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import { TIERS, getTierByName } from "../lib/tiers.js";
import {
  WINDOW_LABELS,
  parseDurationDays,
  windowBounds,
  sumSpend,
  remainingPct,
  isoDate,
} from "../lib/budget-math.js";
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

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[billing/checkout]", message);
    return c.json({ error: message }, 500);
  }
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

// Get current usage and budget.
// Every user/key carries multiple budget windows (1d/7d/30d). We return the tier's
// configured windows plus the current overall spend, and best-effort per-window spend
// if the LiteLLM image exposes it. `budgets` is the source of truth for the UI.
billing.get("/usage", async (c) => {
  const user = c.get("user");

  const buildBudgets = (tierName: string, litellmWindows?: unknown[]) => {
    const tier = getTierByName(tierName) || TIERS.free;
    // Map LiteLLM per-window spend (if present) onto our configured windows by duration.
    const byDuration = new Map<string, number>();
    for (const w of litellmWindows || []) {
      const rec = w as { budget_duration?: string; spend?: number };
      if (rec.budget_duration && typeof rec.spend === "number") {
        byDuration.set(rec.budget_duration, rec.spend);
      }
    }
    return tier.budgetLimits.map((b) => ({
      duration: b.duration,
      max_budget: b.maxBudget,
      spend: byDuration.get(b.duration) ?? null,
    }));
  };

  try {
    const info = await litellm.getUserInfo(user.id);
    const userInfo = info.user_info || {};
    const tierName = userInfo.metadata?.tier || "free";

    return c.json({
      tier: tierName,
      spend: userInfo.spend || 0,
      budgets: buildBudgets(tierName, userInfo.budget_limits),
      models: userInfo.models || TIERS.free.models,
    });
  } catch {
    return c.json({
      tier: "free",
      spend: 0,
      budgets: buildBudgets("free"),
      models: TIERS.free.models,
    });
  }
});

// Remaining budget per rolling window (1d / 7d / 30d), computed with the master
// key so it works even when the user's own key is over-budget (LiteLLM 429s an
// over-budget key on ALL calls, including reads). Per-window spend isn't exposed
// by LiteLLM, so we sum /user/daily/activity, anchoring each window to the user's
// first day (`created_at`). Shape: { windows: [{ duration, label, remainingPct, resetsAt }] }.
billing.get("/budget", async (c) => {
  const user = c.get("user");

  try {
    const info = await litellm.getUserInfo(user.id);
    const userInfo = info.user_info || {};
    const tierName = userInfo.metadata?.tier || "free";
    const tier = getTierByName(tierName) || TIERS.free;

    const createdMs = userInfo.created_at
      ? Date.parse(userInfo.created_at)
      : Date.now();
    const nowMs = Date.now();

    const specs = tier.budgetLimits.map((b) => {
      const nDays = parseDurationDays(b.duration) ?? 1;
      const { start, reset } = windowBounds(createdMs, nowMs, nDays);
      return { duration: b.duration, maxBudget: b.maxBudget, nDays, start, reset };
    });

    const earliest = Math.min(...specs.map((s) => s.start));
    const daily = await litellm.getUserDailySpend(
      user.id,
      isoDate(earliest),
      isoDate(nowMs),
    );

    const windows = specs
      .sort((a, b) => a.nDays - b.nDays)
      .map((s) => ({
        duration: s.duration,
        label: WINDOW_LABELS[s.duration] || s.duration,
        remainingPct: remainingPct(s.maxBudget, sumSpend(daily, s.start, nowMs)),
        resetsAt: new Date(s.reset).toISOString(),
      }));

    return c.json({ windows });
  } catch (err) {
    console.error("[billing/budget]", err);
    return c.json({ error: "budget unavailable" }, 502);
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
