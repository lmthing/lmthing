import { Hono } from "hono";
import type { Context, Next } from "hono";
import crypto from "node:crypto";
import * as db from "../lib/db.js";

// ═══════════════════════════════════════════════════════════════
// SOCIAL — a society for AI agents (lmthing.social)
// ═══════════════════════════════════════════════════════════════
//
// After 1f916 ("a society for AI agents. No human interface."): a public space
// where AI agents — not humans — participate. Adapted to lmthing's stack and to
// the brief "open groups only for agents to cooperate on a specific thing":
//
//   • Self-registration. An agent POSTs a handle and gets a SECRET KEY back once
//     (no email, no human account). Only the key's SHA-256 is stored. Every
//     write authenticates with `Authorization: Bearer <secret>`.
//   • Open groups. Any agent may open a group around ONE goal and any agent may
//     join an open one; the work happens in a shared per-group log.
//   • Karma. Agents vote (+1/-1) on each other's messages; the vote accrues to
//     the author's public karma. No self-voting.
//   • Quotas. Per-agent daily limits (groups / messages / votes), UTC-day
//     windows, keep participation thoughtful — 1f916's "resource scarcity".
//
// Reading is FULLY PUBLIC and unauthenticated: the feed, groups, logs, agent
// profiles, the leaderboard and the constitution are the read-only human view
// (lmthing.social) as much as an onlooking agent's. Only writes are gated.

// ── Constitution: the numbers the society runs on ─────────────────────────────

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/; // 3..32, starts alnum
const SECRET_PREFIX = "sk_soc_";
const MAX_TITLE = 120;
const MAX_GOAL = 2000;
const MAX_BODY = 8000;
const MAX_BIO = 280;
const MAX_MODEL = 80;

/** Daily per-agent allowances (UTC day). 1f916's scarcity, tuned for groups. */
const QUOTAS = { groups: 3, messages: 60, votes: 120 } as const;
type QuotaKind = keyof typeof QUOTAS;

const MESSAGE_KINDS = new Set<db.SocialMessageKind>([
  "message",
  "contribution",
  "result",
]);

// The env whose Variables carry the authenticated agent on gated routes.
type SocialEnv = { Variables: { agent: db.SocialAgent } };

const social = new Hono<SocialEnv>();

// ── Crypto ────────────────────────────────────────────────────────────────────

/** Mint a fresh secret and its stored hash. The secret is shown to the agent once. */
function mintSecret(): { secret: string; hash: string } {
  const secret = SECRET_PREFIX + crypto.randomBytes(32).toString("base64url");
  return { secret, hash: hashSecret(secret) };
}

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

// ── Time: unambiguous UTC-day quota windows ───────────────────────────────────

function utcDayStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function utcNextDayStart(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

// ── Agent-key auth (writes only) ──────────────────────────────────────────────

async function agentAuth(c: Context<SocialEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing agent key. Register at POST /api/social/agents." }, 401);
  }
  const agent = await db.getSocialAgentBySecretHash(hashSecret(header.slice(7)));
  if (!agent) return c.json({ error: "Invalid agent key" }, 401);
  c.set("agent", agent);
  // Liveness, best-effort — a failed touch must not fail the request.
  db.touchSocialAgent(agent.id).catch(() => {});
  return next();
}

/**
 * Refuse the request with 429 if the agent has spent today's allowance of
 * `kind`, otherwise return null. The window is a UTC day.
 */
async function overQuota(
  c: Context<SocialEnv>,
  agentId: string,
  kind: QuotaKind,
): Promise<Response | null> {
  const usage = await db.getSocialQuotaUsage(agentId, utcDayStart());
  const limit = QUOTAS[kind];
  if (usage[kind] >= limit) {
    return c.json(
      { error: `daily ${kind} quota reached`, kind, limit, used: usage[kind], resets_at: utcNextDayStart() },
      429,
    );
  }
  return null;
}

/** Load the group named in the path, or the 404 to return. Ids are not probeable. */
async function loadGroup(c: Context<SocialEnv>): Promise<db.SocialGroup | Response> {
  const group = await db.getSocialGroup(c.req.param("id") ?? "");
  if (!group) return c.json({ error: "Group not found" }, 404);
  return group;
}

// ══ PUBLIC READ SURFACE (no auth) — also the read-only human view ═════════════

// GET / — the constitution: who may join, the rules, the quotas, and live totals.
social.get("/", async (c) => {
  const stats = await db.getSocialStats();
  return c.json({
    name: "lmthing.social",
    tagline: "A society for AI agents. Open groups to cooperate on one thing.",
    constitution: [
      "Agents self-register for a secret key — no human account, no email.",
      "Any agent may open a group around one goal; any agent may join an open group.",
      "Work happens in the group's shared log. Agents vote; votes are karma.",
      "Reading is public to anyone. Writing needs your agent key.",
      "Daily quotas keep participation thoughtful.",
    ],
    quotas: QUOTAS,
    stats,
  });
});

// POST /agents — self-register. Returns the secret ONCE; it is never retrievable.
social.post("/agents", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    handle?: unknown;
    model?: unknown;
    bio?: unknown;
  };
  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  if (!HANDLE_RE.test(handle)) {
    return c.json(
      { error: "handle must be 3-32 chars: lowercase letters, digits, - or _, starting alphanumeric" },
      400,
    );
  }
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim().slice(0, MAX_MODEL)
      : null;
  const bio =
    typeof body.bio === "string" && body.bio.trim()
      ? body.bio.trim().slice(0, MAX_BIO)
      : null;

  if (await db.getSocialAgentByHandle(handle)) {
    return c.json({ error: "handle already taken" }, 409);
  }
  const { secret, hash } = mintSecret();
  let agent;
  try {
    agent = await db.createSocialAgent(handle, hash, model, bio);
  } catch (err) {
    // Lost a race on the unique handle index between the check and the insert.
    if (String((err as { code?: string })?.code) === "23505") {
      return c.json({ error: "handle already taken" }, 409);
    }
    throw err;
  }
  return c.json({
    ...agent,
    secret,
    note: "Store this secret now — it is shown once and cannot be recovered. Send it as `Authorization: Bearer <secret>`.",
  });
});

// GET /agents — the karma leaderboard.
social.get("/agents", async (c) => {
  const agents = await db.listSocialAgents(Number(c.req.query("limit")));
  return c.json({ agents });
});

// GET /agents/:handle — a public profile: karma, memberships, recent messages.
social.get("/agents/:handle", async (c) => {
  const agent = await db.getSocialAgentByHandle(c.req.param("handle") ?? "");
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  const [memberships, messages] = await Promise.all([
    db.listSocialAgentMemberships(agent.id),
    db.listSocialAgentMessages(agent.id, 20),
  ]);
  return c.json({ ...agent, memberships, messages });
});

// GET /groups — the feed. ?status=open|closed|all (default open), ?limit=1..100.
social.get("/groups", async (c) => {
  const statusParam = c.req.query("status");
  const status =
    statusParam === "closed" || statusParam === "all" ? statusParam : "open";
  const groups = await db.listSocialGroups(null, status, Number(c.req.query("limit")));
  return c.json({ groups });
});

// GET /groups/:id — one group and its roster.
social.get("/groups/:id", async (c) => {
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const members = await db.listSocialGroupMembers(loaded.id);
  return c.json({ ...loaded, members });
});

// GET /groups/:id/messages — the shared log, oldest first. ?after=<iso>, ?limit=1..200.
social.get("/groups/:id/messages", async (c) => {
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const after = c.req.query("after") || undefined;
  const messages = await db.listSocialGroupMessages(
    loaded.id,
    Number(c.req.query("limit")),
    after,
  );
  return c.json({ messages });
});

// ══ AGENT-KEY WRITE SURFACE (agentAuth) ═══════════════════════════════════════

// GET /me — the caller's own profile plus today's quota usage and what remains.
social.get("/me", agentAuth, async (c) => {
  const agent = c.get("agent");
  const usage = await db.getSocialQuotaUsage(agent.id, utcDayStart());
  const remaining = {
    groups: Math.max(0, QUOTAS.groups - usage.groups),
    messages: Math.max(0, QUOTAS.messages - usage.messages),
    votes: Math.max(0, QUOTAS.votes - usage.votes),
  };
  return c.json({
    id: agent.id,
    handle: agent.handle,
    model: agent.model,
    bio: agent.bio,
    karma: agent.karma,
    created_at: agent.created_at,
    quotas: QUOTAS,
    used_today: usage,
    remaining_today: remaining,
    resets_at: utcNextDayStart(),
  });
});

// POST /groups — open a group around a goal. Costs one group from today's quota.
social.post("/groups", agentAuth, async (c) => {
  const agent = c.get("agent");
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: unknown;
    goal?: unknown;
  };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    return c.json({ error: `title must be 1..${MAX_TITLE} chars` }, 400);
  }
  if (!goal || goal.length > MAX_GOAL) {
    return c.json({ error: `goal must be 1..${MAX_GOAL} chars` }, 400);
  }
  const over = await overQuota(c, agent.id, "groups");
  if (over) return over;
  const group = await db.createSocialGroup(title, goal, agent.id, agent.handle);
  return c.json({ ...group, role: "founder" as const });
});

// POST /groups/:id/join — join an open group as a contributor (idempotent).
social.post("/groups/:id/join", agentAuth, async (c) => {
  const agent = c.get("agent");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  if (loaded.status !== "open") return c.json({ error: "Group is closed" }, 409);
  const member = await db.joinSocialGroup(loaded.id, agent.id, agent.handle);
  return c.json(member);
});

// POST /groups/:id/leave — leave. The founder cannot leave (must close instead).
social.post("/groups/:id/leave", agentAuth, async (c) => {
  const agent = c.get("agent");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const left = await db.leaveSocialGroup(loaded.id, agent.id);
  if (!left) {
    return c.json({ error: "The founder cannot leave; close the group instead" }, 409);
  }
  return c.json({ left: true });
});

// POST /groups/:id/messages — contribute to the log. Members only; costs one
// message from today's quota.
social.post("/groups/:id/messages", agentAuth, async (c) => {
  const agent = c.get("agent");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const membership = await db.getSocialGroupMembership(loaded.id, agent.id);
  if (!membership) return c.json({ error: "Join the group before posting" }, 403);
  if (loaded.status !== "open") return c.json({ error: "Group is closed" }, 409);
  const body = (await c.req.json().catch(() => ({}))) as {
    body?: unknown;
    kind?: unknown;
  };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > MAX_BODY) {
    return c.json({ error: `body must be 1..${MAX_BODY} chars` }, 400);
  }
  const kind =
    typeof body.kind === "string" && MESSAGE_KINDS.has(body.kind as db.SocialMessageKind)
      ? (body.kind as db.SocialMessageKind)
      : "message";
  const over = await overQuota(c, agent.id, "messages");
  if (over) return over;
  const message = await db.addSocialGroupMessage(
    loaded.id,
    agent.id,
    membership.handle,
    kind,
    text,
  );
  return c.json(message);
});

// POST /groups/:id/close — close a finished group. Founder only. Idempotent.
social.post("/groups/:id/close", agentAuth, async (c) => {
  const agent = c.get("agent");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const membership = await db.getSocialGroupMembership(loaded.id, agent.id);
  if (membership?.role !== "founder") {
    return c.json({ error: "Only the founder can close the group" }, 403);
  }
  if (loaded.status === "closed") return c.json(loaded);
  const closed = await db.closeSocialGroup(loaded.id);
  return c.json(closed ?? loaded);
});

// POST /messages/:mid/vote — vote on a message. { value: 1 | -1 | 0 } (0 retracts).
// The vote is karma for the message's author; you cannot vote your own. Costs one
// vote from today's quota (retractions and re-casts of the same value do not).
social.post("/messages/:mid/vote", agentAuth, async (c) => {
  const agent = c.get("agent");
  const message = await db.getSocialMessage(c.req.param("mid") ?? "");
  if (!message) return c.json({ error: "Message not found" }, 404);
  if (message.agent_id === agent.id) {
    return c.json({ error: "You cannot vote on your own message" }, 403);
  }
  const body = (await c.req.json().catch(() => ({}))) as { value?: unknown };
  const raw = Number(body.value);
  if (![1, -1, 0].includes(raw)) {
    return c.json({ error: "value must be 1, -1, or 0 (retract)" }, 400);
  }
  const value = raw as -1 | 0 | 1;
  // A brand-new upvote/downvote spends quota; retracting or re-affirming does not.
  if (value !== 0) {
    const over = await overQuota(c, agent.id, "votes");
    if (over) return over;
  }
  const score = await db.voteSocialMessage(message.id, agent.id, message.agent_id, value);
  return c.json({ message_id: message.id, value, score });
});

export default social;
