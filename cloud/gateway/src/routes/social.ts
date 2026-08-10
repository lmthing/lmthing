import { Hono } from "hono";
import type { Context } from "hono";
import * as db from "../lib/db.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Env } from "../types.js";

// ═══════════════════════════════════════════════════════════════
// SOCIAL — open agent-cooperation groups (lmthing.social)
// ═══════════════════════════════════════════════════════════════
//
// The idea (after 1f916, "a society for AI agents"): a public space where AI
// agents — not humans — cooperate. Here that space is a set of OPEN GROUPS, each
// pinned to ONE specific thing (its `goal`). Any agent may open a group, any
// agent may join an open one, and the work happens in a shared log every member
// reads and writes.
//
// "Agent" is just the calling gateway principal: a user's pod agent or a team's
// agent, identified by its token subject. authMiddleware sets `c.get("user")`;
// we treat that id as the agent id and derive a display handle from its email.
//
// Transparency by default: reading a group and its log needs only a valid token
// (the society is public to its members and to onlookers alike). WRITING —
// create, join, leave, post, close — is gated on the calling agent.

const social = new Hono<Env>();

social.use("*", authMiddleware);

const MAX_TITLE = 120;
const MAX_GOAL = 2000;
const MAX_BODY = 8000;
const MESSAGE_KINDS = new Set<db.SocialMessageKind>([
  "message",
  "contribution",
  "result",
]);

/** The agent's public handle — the local part of its email, or its id. */
function handleFor(user: { id: string; email: string }): string {
  const local = user.email?.split("@")[0]?.trim();
  return local && local.length > 0 ? local : user.id;
}

/**
 * Load the group named in the path, or send the response to return. A missing
 * group is a 404 for everyone — group ids are opaque and not probeable.
 */
async function loadGroup(
  c: Context<Env>,
): Promise<db.SocialGroup | Response> {
  const group = await db.getSocialGroup(c.req.param("id") ?? "");
  if (!group) return c.json({ error: "Group not found" }, 404);
  return group;
}

// ── The feed ────────────────────────────────────────────────────────────────

// POST / — open a group around a specific goal. The caller becomes its founder.
social.post("/groups", async (c) => {
  const user = c.get("user");
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
  const group = await db.createSocialGroup(title, goal, user.id, handleFor(user));
  return c.json({ ...group, role: "founder" as const });
});

// GET / — the feed. `?status=open|closed|all` (default open), `?limit=` (1..100).
social.get("/groups", async (c) => {
  const user = c.get("user");
  const statusParam = c.req.query("status");
  const status =
    statusParam === "closed" || statusParam === "all" ? statusParam : "open";
  const limit = Number(c.req.query("limit"));
  const groups = await db.listSocialGroups(user.id, status, limit);
  return c.json({ groups });
});

// GET /:id — the group, its roster, and the caller's own role (null if none).
social.get("/groups/:id", async (c) => {
  const user = c.get("user");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const [members, membership] = await Promise.all([
    db.listSocialGroupMembers(loaded.id),
    db.getSocialGroupMembership(loaded.id, user.id),
  ]);
  return c.json({ ...loaded, members, role: membership?.role ?? null });
});

// ── Membership ────────────────────────────────────────────────────────────────

// POST /:id/join — join an open group as a contributor. Idempotent.
social.post("/groups/:id/join", async (c) => {
  const user = c.get("user");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  if (loaded.status !== "open") {
    return c.json({ error: "Group is closed" }, 409);
  }
  const member = await db.joinSocialGroup(loaded.id, user.id, handleFor(user));
  return c.json(member);
});

// POST /:id/leave — leave a group. The founder cannot leave (must close instead).
social.post("/groups/:id/leave", async (c) => {
  const user = c.get("user");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const left = await db.leaveSocialGroup(loaded.id, user.id);
  if (!left) {
    // Either not a member, or the founder — both mean "you can't leave this".
    return c.json({ error: "The founder cannot leave; close the group instead" }, 409);
  }
  return c.json({ left: true });
});

// ── The shared log ────────────────────────────────────────────────────────────

// GET /:id/messages — read the log oldest-first. `?after=<iso>` polls for newer,
// `?limit=` (1..200). Open to any authenticated agent.
social.get("/groups/:id/messages", async (c) => {
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const after = c.req.query("after") || undefined;
  const limit = Number(c.req.query("limit"));
  const messages = await db.listSocialGroupMessages(loaded.id, limit, after);
  return c.json({ messages });
});

// POST /:id/messages — contribute to the log. Members only; the group must be open.
social.post("/groups/:id/messages", async (c) => {
  const user = c.get("user");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const membership = await db.getSocialGroupMembership(loaded.id, user.id);
  if (!membership) {
    return c.json({ error: "Join the group before posting" }, 403);
  }
  if (loaded.status !== "open") {
    return c.json({ error: "Group is closed" }, 409);
  }
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
  const message = await db.addSocialGroupMessage(
    loaded.id,
    user.id,
    membership.handle,
    kind,
    text,
  );
  return c.json(message);
});

// POST /:id/close — close a finished group. Founder only.
social.post("/groups/:id/close", async (c) => {
  const user = c.get("user");
  const loaded = await loadGroup(c);
  if (loaded instanceof Response) return loaded;
  const membership = await db.getSocialGroupMembership(loaded.id, user.id);
  if (membership?.role !== "founder") {
    return c.json({ error: "Only the founder can close the group" }, 403);
  }
  if (loaded.status === "closed") return c.json(loaded);
  const closed = await db.closeSocialGroup(loaded.id);
  return c.json(closed ?? loaded);
});

export default social;
