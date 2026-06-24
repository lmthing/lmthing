import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import {
  getUserPodStatus,
  getEnvVars,
  setEnvVars,
  ensureUserPod,
  restartUserPod,
  COMPUTE_IMAGE_TAG,
} from "../lib/compute.js";
import * as litellm from "../lib/litellm.js";
import { getTierByName } from "../lib/tiers.js";
import type { Env } from "../types.js";

const compute = new Hono<Env>();

/** Resolve the tier name for a user via LiteLLM metadata. Defaults to "free". */
async function resolveUserTier(userId: string): Promise<string> {
  try {
    const info = await litellm.getUserInfo(userId);
    return info.user_info?.metadata?.tier || "free";
  } catch {
    return "free";
  }
}

// GET /version — returns the latest available compute image tag. Public (no auth).
compute.get("/version", (c) => {
  return c.json({ tag: COMPUTE_IMAGE_TAG || null });
});

// POST /upgrade — trigger a rolling restart of the user's pod so it pulls the
// latest compute image. The pod stays alive until the new replica is ready.
compute.post("/upgrade", authMiddleware, async (c) => {
  const user = c.get("user");
  try {
    await restartUserPod(user.id);
    return c.json({ ok: true });
  } catch (err) {
    console.error(`Failed to restart pod for ${user.id}:`, err);
    return c.json({ error: "Failed to restart compute pod" }, 500);
  }
});

// GET /status — returns compute pod status for the authenticated user.
// All tiers now have compute access; the pod may be scaled to zero if idle.
compute.get("/status", authMiddleware, async (c) => {
  const user = c.get("user");
  const tierName = await resolveUserTier(user.id);
  const tier = getTierByName(tierName);

  try {
    const pod = await getUserPodStatus(user.id);
    return c.json({
      compute: true,
      tier: tierName,
      pod,
      podConfig: tier?.pod ?? null,
    });
  } catch (err) {
    console.error(`Failed to get pod status for ${user.id}:`, err);
    return c.json({
      compute: true,
      tier: tierName,
      pod: { exists: false, ready: false, phase: "error" },
      podConfig: tier?.pod ?? null,
    });
  }
});

// POST /ensure — lazily provision or wake up the user's compute pod.
// Returns the in-cluster connection info once the pod is running (or starting).
compute.post("/ensure", authMiddleware, async (c) => {
  const user = c.get("user");
  const tierName = await resolveUserTier(user.id);
  const tier = getTierByName(tierName);

  if (!tier) {
    return c.json({ error: "Unknown tier" }, 500);
  }

  try {
    const connection = await ensureUserPod(user.id, tier.pod);
    // Return status so the client knows whether to poll for readiness
    const status = await getUserPodStatus(user.id);
    return c.json({
      ok: true,
      tier: tierName,
      podConfig: tier.pod,
      connection,
      pod: status,
    });
  } catch (err) {
    console.error(`Failed to ensure pod for ${user.id}:`, err);
    return c.json({ error: "Failed to provision compute pod" }, 500);
  }
});

// GET /env — list env vars for the authenticated user's pod
compute.get("/env", authMiddleware, async (c) => {
  const user = c.get("user");

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
      return c.json(
        {
          error: `Invalid key: "${k}". Keys must start with a letter or underscore and contain only letters, digits, and underscores.`,
        },
        400,
      );
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
