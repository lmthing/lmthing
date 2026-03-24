import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { getUserPodStatus } from "../lib/compute.js";
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

export default compute;
