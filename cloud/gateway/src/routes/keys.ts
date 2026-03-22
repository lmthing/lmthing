import { Hono } from "hono";
import * as litellm from "../lib/litellm.js";
import { TIERS } from "../lib/tiers.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Env } from "../types.js";

const keys = new Hono<Env>();

keys.use("*", authMiddleware);

// List all API keys for the authenticated user
keys.get("/", async (c) => {
  const user = c.get("user");
  const result = await litellm.listKeys(user.id);

  const safeKeys = result.map((k: any) => ({
    token: k.token,
    key_alias: k.key_alias,
    key_name: k.key_name,
    spend: k.spend,
    max_budget: k.max_budget,
    models: k.models,
    tier: k.metadata?.tier || "free",
    created_at: k.created_at,
    expires: k.expires,
  }));

  return c.json({ keys: safeKeys });
});

// Create a new API key
keys.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined as string | undefined }));

  // Get user's current tier from LiteLLM
  let tierName = "free";
  try {
    const info = await litellm.getUserInfo(user.id);
    tierName = info.user_info?.metadata?.tier || "free";
  } catch {
    // default to free
  }

  const tier = TIERS[tierName] || TIERS.free;
  const keyResult = await litellm.generateKey(
    user.id,
    tier,
    body.name || `key-${Date.now()}`,
  );

  return c.json({
    key: keyResult.key,
    key_alias: body.name || keyResult.key_alias,
    tier: tierName,
    models: tier.models.length > 0 ? tier.models : "all",
    max_budget: tier.budget,
    budget_duration: tier.budgetDuration,
  });
});

// Revoke an API key
keys.delete("/:token", async (c) => {
  const token = c.req.param("token");
  await litellm.deleteKey(token);
  return c.json({ deleted: true });
});

export default keys;
