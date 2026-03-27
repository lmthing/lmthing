import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { getUserPodStatus, getEnvVars, setEnvVars } from "../lib/compute.js";
import * as litellm from "../lib/litellm.js";
import type { Env } from "../types.js";

const compute = new Hono<Env>();

// GET /status — returns compute pod status for the authenticated user
compute.get("/status", authMiddleware, async (c) => {
  const user = c.get("user");

  // Check user's tier to determine if they have compute access
  let tier = "free";
  try {
    const info = await litellm.getUserInfo(user.id);
    tier = info.user_info?.metadata?.tier || "free";
  } catch {
    // Default to free
  }

  const hasCompute = tier === "pro" || tier === "max";

  if (!hasCompute) {
    return c.json({
      compute: false,
      tier,
      pod: { exists: false, ready: false, phase: null },
    });
  }

  try {
    const pod = await getUserPodStatus(user.id);
    return c.json({ compute: true, tier, pod });
  } catch (err) {
    console.error(`Failed to get pod status for ${user.id}:`, err);
    return c.json({
      compute: true,
      tier,
      pod: { exists: false, ready: false, phase: "error" },
    });
  }
});

// GET /env — list env vars for the authenticated user's pod
compute.get("/env", authMiddleware, async (c) => {
  const user = c.get("user");

  let tier = "free";
  try {
    const info = await litellm.getUserInfo(user.id);
    tier = info.user_info?.metadata?.tier || "free";
  } catch {
    // default to free
  }

  if (tier !== "pro" && tier !== "max") {
    return c.json({ error: "Compute pod required" }, 403);
  }

  try {
    const vars = await getEnvVars(user.id);
    return c.json({ vars });
  } catch (err) {
    console.error(`Failed to get env vars for ${user.id}:`, err);
    return c.json({ error: "Failed to fetch env vars" }, 500);
  }
});

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// PUT /env — replace all env vars (triggers pod restart)
compute.put("/env", authMiddleware, async (c) => {
  const user = c.get("user");

  let tier = "free";
  try {
    const info = await litellm.getUserInfo(user.id);
    tier = info.user_info?.metadata?.tier || "free";
  } catch {
    // default to free
  }

  if (tier !== "pro" && tier !== "max") {
    return c.json({ error: "Compute pod required" }, 403);
  }

  let body: { vars?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const vars = body.vars;
  if (typeof vars !== "object" || vars === null || Array.isArray(vars)) {
    return c.json({ error: "vars must be an object" }, 400);
  }

  const validated: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    if (!KEY_RE.test(k)) {
      return c.json({ error: `Invalid key: "${k}". Keys must start with a letter or underscore and contain only letters, digits, and underscores.` }, 400);
    }
    if (typeof v !== "string") {
      return c.json({ error: `Value for "${k}" must be a string` }, 400);
    }
    validated[k] = v;
  }

  if (Object.keys(validated).length > 100) {
    return c.json({ error: "Maximum 100 environment variables allowed" }, 400);
  }

  try {
    await setEnvVars(user.id, validated);
    return c.json({ ok: true });
  } catch (err) {
    console.error(`Failed to set env vars for ${user.id}:`, err);
    return c.json({ error: "Failed to update env vars" }, 500);
  }
});

export default compute;
