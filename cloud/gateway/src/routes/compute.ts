import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import {
  getPodStatus,
  getEnvVars,
  setEnvVars,
  ensurePod,
  wakePod,
  wakeAndWaitPod,
  restartPod,
  reportPodActivity,
  userPrincipal,
  teamPrincipal,
  parsePrincipalKey,
  principalKey as principalKeyOf,
  type PodPrincipal,
  COMPUTE_IMAGE_TAG,
} from "../lib/compute.js";
import * as litellm from "../lib/litellm.js";
import { getTierByName } from "../lib/tiers.js";
import { verifyComputeToken, verifyTeamToken } from "../lib/tokens.js";
import {
  replaceCronManifest,
  type CronManifestJob,
  upsertWebhookBindings,
  type WebhookBinding,
} from "../lib/db.js";
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

// ─── Pod → gateway autonomous calls (compute-JWT authed, NOT authMiddleware) ───

/**
 * Extract + verify the pod's scoped compute JWT → its principal key, or null.
 * A team pod's token carries `team-<id>`, so the manifests and activity reports
 * it publishes land under the team's own rows.
 */
async function computeUser(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<string | null> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const v = await verifyComputeToken(header.slice(7));
  return v?.userId ?? null;
}

/**
 * Which pod a wake request is for. The Envoy activator forwards whatever token
 * the original caller presented: on lmthing.team that is a team token, whose
 * `team` claim names the pod to wake; everywhere else it is a personal token and
 * the pod is the caller's own. The signed claim IS the authorization — the same
 * trust model the personal path already uses — so there is no DB re-check on a
 * path that must return immediately.
 */
async function resolveWakePrincipal(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<PodPrincipal | null> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const team = await verifyTeamToken(token);
  if (team) return teamPrincipal(team.teamId);
  return null;
}

// Deterministic per-job jitter window so many users' same-minute jobs (e.g. a
// daily 09:00 digest) don't stampede the gateway's cron-wake tick.
const CRON_JITTER_MS = 5 * 60_000;
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// POST /self-idle — the pod reports its activity. Body `{ idle: boolean }`:
//   idle:true (or empty body) → scale the pod to 0 (race-guarded);
//   idle:false → heartbeat (refresh the idle-sweep backstop clock).
// Authed by the injected compute JWT, so a pod can only act on its own namespace.
compute.post("/self-idle", async (c) => {
  const userId = await computeUser(c);
  if (!userId) return c.json({ error: "Invalid compute token" }, 401);
  let body: { idle?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty body ⇒ idle:true default */
  }
  const idle = body.idle !== false; // default true — a bare POST means "I'm idle"
  try {
    const outcome = await reportPodActivity(parsePrincipalKey(userId), idle);
    return c.json({ ok: true, outcome });
  } catch (err) {
    console.error(`self-idle failed for ${userId}:`, err);
    return c.json({ error: "self-idle failed" }, 500);
  }
});

// POST /cron-manifest — the pod publishes its full cron schedule. Body
// `{ jobs: [{ projectId, slug, cronExpr, everyMs, nextRunAt }] }`. The gateway
// enforces the tier cron policy (clamp interval to the floor, cap job count,
// jitter next_run_at) then replaces the user's stored manifest. The always-on
// cron-wake tick (cluster-status.ts) wakes the pod at each due next_run_at.
compute.post("/cron-manifest", async (c) => {
  const userId = await computeUser(c);
  if (!userId) return c.json({ error: "Invalid compute token" }, 401);

  let body: { jobs?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const rawJobs = Array.isArray(body.jobs) ? body.jobs : [];

  const tierName = await resolveUserTier(userId);
  const tier = getTierByName(tierName) ?? getTierByName("free")!;
  const policy = tier.cron;

  const seen = new Set<string>();
  const jobs: CronManifestJob[] = [];
  for (const raw of rawJobs) {
    if (!raw || typeof raw !== "object") continue;
    const j = raw as Record<string, unknown>;
    const projectId = typeof j.projectId === "string" ? j.projectId : "";
    const slug = typeof j.slug === "string" ? j.slug : "";
    const cronExpr = typeof j.cronExpr === "string" ? j.cronExpr : "";
    const everyMsRaw = Number(j.everyMs);
    const nextRunAtRaw = Number(j.nextRunAt);
    if (!projectId || !slug || !cronExpr) continue;
    if (!Number.isFinite(everyMsRaw) || !Number.isFinite(nextRunAtRaw)) continue;
    const key = `${projectId}/${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Clamp interval up to the tier floor; jitter the fire time deterministically.
    const everyMs = Math.max(everyMsRaw, policy.minIntervalMs);
    const jitter = hashStr(`${userId}:${key}`) % CRON_JITTER_MS;
    jobs.push({ projectId, slug, cronExpr, everyMs, nextRunAt: nextRunAtRaw + jitter });
    if (jobs.length >= policy.maxJobs) break;
  }

  try {
    await replaceCronManifest(userId, jobs, policy.minIntervalMs);
    return c.json({ ok: true, accepted: jobs.length });
  } catch (err) {
    console.error(`cron-manifest failed for ${userId}:`, err);
    return c.json({ error: "cron-manifest failed" }, 500);
  }
});

// POST /webhook-manifest — the pod publishes the full set of project-app
// webhook hooks it currently has registered. Body
// `{ bindings: [{ projectId, path, provider, agentRef }] }`. Sibling of
// /cron-manifest: same compute-JWT auth, same replace-all-for-this-user
// persistence, so the public inbound broker (routes/inbound.ts) can resolve a
// path without asking the pod, and the UI (GET /api/inbound) can list them.
compute.post("/webhook-manifest", async (c) => {
  const userId = await computeUser(c);
  if (!userId) return c.json({ error: "Invalid compute token" }, 401);

  let body: { bindings?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const rawBindings = Array.isArray(body.bindings) ? body.bindings : [];

  const seen = new Set<string>();
  const bindings: WebhookBinding[] = [];
  for (const raw of rawBindings) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const path = typeof b.path === "string" ? b.path : "";
    if (!path || seen.has(path)) continue;
    seen.add(path);
    bindings.push({
      path,
      provider: typeof b.provider === "string" ? b.provider : null,
      agentRef: typeof b.agentRef === "string" ? b.agentRef : null,
      projectId: typeof b.projectId === "string" ? b.projectId : null,
    });
  }

  try {
    await upsertWebhookBindings(userId, bindings);
    return c.json({ ok: true, accepted: bindings.length });
  } catch (err) {
    console.error(`webhook-manifest failed for ${userId}:`, err);
    return c.json({ error: "webhook-manifest failed" }, 500);
  }
});

// GET /version — returns the latest available compute image tag. Public (no auth).
compute.get("/version", (c) => {
  return c.json({ tag: COMPUTE_IMAGE_TAG || null });
});

// POST /upgrade — trigger a rolling restart of the user's pod so it pulls the
// latest compute image. The pod stays alive until the new replica is ready.
compute.post("/upgrade", authMiddleware, async (c) => {
  const user = c.get("user");
  try {
    await restartPod(userPrincipal(user.id));
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
    const pod = await getPodStatus(userPrincipal(user.id));
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
    const connection = await ensurePod(userPrincipal(user.id), tier.pod);
    // Return status so the client knows whether to poll for readiness
    const status = await getPodStatus(userPrincipal(user.id));
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

// POST /wake — the Envoy activator calls this when a request hits a scaled-to-
// zero pod (no Service endpoints → Envoy 503). The activator forwards the
// request's already-validated gateway JWT, so `authMiddleware` authenticates it
// exactly like /ensure — a caller can only wake its OWN pod (no new attack
// surface, no shared secret). Fire-and-forget: scale 0→1 without the readiness
// wait and return 202 immediately; the original caller retries into the waking
// pod. Idempotent + cheap, so every retry in the wake window is safe.
compute.post("/wake", authMiddleware, async (c) => {
  const user = c.get("user");
  // On lmthing.team the forwarded token is a team token — wake the TEAM's pod,
  // not the member's own. A team token also satisfies authMiddleware (it carries
  // sub+email), so the team claim has to be what decides.
  const principal = (await resolveWakePrincipal(c)) ?? userPrincipal(user.id);
  const tierName = await resolveUserTier(principalKeyOf(principal));
  const tier = getTierByName(tierName) ?? getTierByName("free")!;
  try {
    await wakePod(principal, tier.pod);
    return c.json({ ok: true, waking: true }, 202);
  } catch (err) {
    console.error(`[activator] wake failed for ${principalKeyOf(principal)}:`, err);
    return c.json({ error: "wake failed" }, 500);
  }
});

// POST /wake-wait — like /wake but BLOCKS until the pod is serving (bounded).
// Backs the lmthing.app zero-reload wake: Envoy issues a synchronous httpCall to
// this on a cold document navigation, then lets the original request through to
// the now-ready pod — no waking-screen reload loop. Returns 200 when ready, 202
// if it didn't come up within the bound (Envoy then falls back to the waking
// HTML). A warm pod short-circuits via the ready cache (no k8s / LiteLLM cost).
compute.post("/wake-wait", authMiddleware, async (c) => {
  const user = c.get("user");
  const principal = (await resolveWakePrincipal(c)) ?? userPrincipal(user.id);
  try {
    // 8s bound: under both the ~9s Envoy httpCall timeout and the ~15s ingress
    // timeout, so this route always returns before either fires.
    const ready = await wakeAndWaitPod(principal, 8000);
    return c.json({ ok: true, ready }, ready ? 200 : 202);
  } catch (err) {
    console.error(`[wake-wait] failed for ${principalKeyOf(principal)}:`, err);
    return c.json({ error: "wake-wait failed" }, 500);
  }
});

// GET /env — list env vars for the authenticated user's pod
compute.get("/env", authMiddleware, async (c) => {
  const user = c.get("user");

  try {
    const vars = await getEnvVars(userPrincipal(user.id));
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
    await setEnvVars(userPrincipal(user.id), validated);
    return c.json({ ok: true });
  } catch (err) {
    console.error(`Failed to set env vars for ${user.id}:`, err);
    return c.json({ error: "Failed to update env vars" }, 500);
  }
});

export default compute;
