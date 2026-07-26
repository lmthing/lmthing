import { Hono } from "hono";
import type { Context } from "hono";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import * as zitadel from "../lib/zitadel.js";
import * as db from "../lib/db.js";
import { TIERS } from "../lib/tiers.js";
import { authMiddleware } from "../middleware/auth.js";
import { signTeamToken } from "../lib/tokens.js";
import {
  ensurePod,
  getPodStatus,
  getEnvVars,
  setEnvVars,
  restartPod,
  teamPrincipal,
} from "../lib/compute.js";
import { getTierByName } from "../lib/tiers.js";
import type { Env } from "../types.js";

// ═══════════════════════════════════════════════════════════════
// TEAMS — shared workspaces with their own pod, tier and credentials
// ═══════════════════════════════════════════════════════════════
//
// A team is its own principal, not a share of someone's: it owns a compute pod
// (namespace `team-<id>`), a LiteLLM user (`team-<id>`) with its own budget, and
// a Stripe customer. Members hold a role — `viewer` (use the team's spaces and
// apps, read the projects, chat with THING) or `editor` (that, plus editing
// projects and spaces and configuring the team).
//
// These routes are the control plane and take a PERSONAL access token: they are
// about which teams you belong to. Reaching the team's pod is a separate step —
// POST /:teamId/token mints the team-scoped token that lmthing.team presents to
// Envoy, which routes it to the team's namespace.

const teams = new Hono<Env>();

teams.use("*", authMiddleware);

/** The team's principal id — its LiteLLM user, pod namespace and DB key. */
export function teamPrincipalKey(teamId: string): string {
  return `team-${teamId}`;
}

/**
 * Resolve the caller's membership, or return the response to send. Membership
 * is checked on every team route: a team id in a URL grants nothing on its own.
 */
async function requireMember(
  c: Context<Env>,
  teamId: string,
  minRole?: db.TeamRole,
): Promise<db.TeamMember | Response> {
  const user = c.get("user");
  const membership = await db.getTeamMembership(teamId, user.id);
  // Same 404 whether the team doesn't exist or you're simply not on it — team
  // ids shouldn't be probeable for existence.
  if (!membership) return c.json({ error: "Team not found" }, 404);
  if (minRole === "editor" && membership.role !== "editor") {
    return c.json({ error: "Editor role required" }, 403);
  }
  return membership;
}

function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}

function parseRole(value: unknown): db.TeamRole | null {
  return value === "viewer" || value === "editor" ? value : null;
}

/**
 * Give a new team its own billing identity and LLM budget: a Stripe customer and
 * a LiteLLM user on the free tier, keyed `team-<id>`. Best-effort — a team whose
 * provisioning half-failed is still usable for chat and is repaired on the next
 * compute ensure, so we don't strand the caller on a Stripe blip.
 */
async function provisionTeam(
  teamId: string,
  name: string,
  creatorEmail: string,
): Promise<{ stripeCustomerId: string | null }> {
  const key = teamPrincipalKey(teamId);
  let stripeCustomerId: string | null = null;
  try {
    const customer = await stripe.customers.create({
      email: creatorEmail,
      name,
      metadata: { team_id: teamId },
    });
    stripeCustomerId = customer.id;
  } catch (err) {
    console.error("[teams] stripe customer create failed:", err);
  }
  try {
    await litellm.createUser(key, TIERS.free, {
      team_id: teamId,
      ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    });
  } catch (err) {
    console.error("[teams] litellm user create failed:", err);
  }
  return { stripeCustomerId };
}

// ── Teams ────────────────────────────────────────────────────────────────────

// POST / — create a team; the creator becomes its first editor
teams.post("/", async (c) => {
  const user = c.get("user");
  const { name } = await c.req.json<{ name?: string }>().catch(() => ({
    name: undefined,
  }));

  const trimmed = (name ?? "").trim();
  if (!trimmed) return c.json({ error: "name is required" }, 400);
  if (trimmed.length > 100) {
    return c.json({ error: "name must be at most 100 characters" }, 400);
  }

  // The row first: it mints the id that the Stripe/LiteLLM principals are keyed
  // on, and it's the only part that must not fail silently.
  let team: db.Team;
  try {
    team = await db.createTeam(trimmed, user.id, user.email, null);
  } catch (err) {
    console.error("[teams] createTeam failed:", err);
    return c.json({ error: "Failed to create team" }, 500);
  }

  const { stripeCustomerId } = await provisionTeam(team.id, trimmed, user.email);
  if (stripeCustomerId) {
    await db
      .setTeamStripeCustomer(team.id, stripeCustomerId)
      .catch((err) => console.error("[teams] setTeamStripeCustomer failed:", err));
  }

  return c.json({
    id: team.id,
    name: team.name,
    role: "editor" as const,
    created_at: team.created_at,
  });
});

// GET / — teams I'm on, plus invites addressed to me
teams.get("/", async (c) => {
  const user = c.get("user");
  const [memberships, invites] = await Promise.all([
    db.listTeamsForUser(user.id),
    db.listPendingInvitesForEmail(user.email),
  ]);
  return c.json({
    teams: memberships.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
      created_at: t.created_at,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      team_id: i.team_id,
      team_name: i.team_name,
      role: i.role,
      expires_at: i.expires_at,
    })),
  });
});

// GET /:teamId — the team plus its roster
teams.get("/:teamId", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId);
  if (isResponse(membership)) return membership;

  const [team, members, invites] = await Promise.all([
    db.getTeam(teamId),
    db.listTeamMembers(teamId),
    db.listTeamInvites(teamId),
  ]);
  if (!team) return c.json({ error: "Team not found" }, 404);

  return c.json({
    id: team.id,
    name: team.name,
    created_at: team.created_at,
    role: membership.role,
    members: members.map((m) => ({
      user_id: m.user_id,
      email: m.email,
      role: m.role,
      created_at: m.created_at,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expires_at: i.expires_at,
    })),
  });
});

// PUT /:teamId — rename
teams.put("/:teamId", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

  const { name } = await c.req.json<{ name?: string }>().catch(() => ({
    name: undefined,
  }));
  const trimmed = (name ?? "").trim();
  if (!trimmed) return c.json({ error: "name is required" }, 400);
  if (trimmed.length > 100) {
    return c.json({ error: "name must be at most 100 characters" }, 400);
  }

  await db.setTeamName(teamId, trimmed);
  return c.json({ id: teamId, name: trimmed });
});

// ── Membership ───────────────────────────────────────────────────────────────

// POST /:teamId/members — add by email, or record an invite if they have no account
teams.post("/:teamId/members", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

  const body = await c.req
    .json<{ email?: string; role?: string }>()
    .catch(() => ({ email: undefined, role: undefined }));
  const email = (body.email ?? "").trim().toLowerCase();
  const role = parseRole(body.role ?? "viewer");
  if (!email) return c.json({ error: "email is required" }, 400);
  if (!role) return c.json({ error: "role must be 'viewer' or 'editor'" }, 400);

  const user = c.get("user");

  // Someone with an account joins immediately; someone without gets a pending
  // invite they claim after signing up (there is no mailer — the inviter shares
  // the lmthing.team link).
  let existing: { id: string; email: string } | null = null;
  try {
    existing = await zitadel.getUserByEmail(email);
  } catch {
    existing = null;
  }

  if (existing) {
    await db.upsertTeamMember(teamId, existing.id, email, role, user.id);
    return c.json({ status: "added", user_id: existing.id, email, role });
  }

  const invite = await db.upsertTeamInvite(teamId, email, role, user.id);
  return c.json({
    status: "invited",
    invite_id: invite.id,
    email,
    role,
    expires_at: invite.expires_at,
  });
});

// PUT /:teamId/members/:userId — change a member's role
teams.put("/:teamId/members/:userId", async (c) => {
  const teamId = c.req.param("teamId");
  const targetId = c.req.param("userId");
  const membership = await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

  const body = await c.req.json<{ role?: string }>().catch(() => ({
    role: undefined,
  }));
  const role = parseRole(body.role);
  if (!role) return c.json({ error: "role must be 'viewer' or 'editor'" }, 400);

  const target = await db.getTeamMembership(teamId, targetId);
  if (!target) return c.json({ error: "Member not found" }, 404);

  const ok = await db.updateTeamMemberRole(teamId, targetId, role);
  if (!ok) {
    return c.json({ error: "A team must keep at least one editor" }, 409);
  }
  return c.json({ user_id: targetId, role });
});

// DELETE /:teamId/members/:userId — remove a member (or leave the team yourself)
teams.delete("/:teamId/members/:userId", async (c) => {
  const teamId = c.req.param("teamId");
  const targetId = c.req.param("userId");
  const user = c.get("user");

  // Leaving is always your own right; removing someone else is an editor action.
  const membership =
    targetId === user.id
      ? await requireMember(c, teamId)
      : await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

  const ok = await db.removeTeamMember(teamId, targetId);
  if (!ok) {
    const target = await db.getTeamMembership(teamId, targetId);
    if (!target) return c.json({ error: "Member not found" }, 404);
    return c.json({ error: "A team must keep at least one editor" }, 409);
  }
  return c.json({ removed: targetId });
});

// DELETE /:teamId/invites/:inviteId — revoke a pending invite
teams.delete("/:teamId/invites/:inviteId", async (c) => {
  const teamId = c.req.param("teamId");
  const inviteId = c.req.param("inviteId");
  const membership = await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

  const invite = await db.getTeamInvite(inviteId);
  if (!invite || invite.team_id !== teamId) {
    return c.json({ error: "Invite not found" }, 404);
  }
  await db.revokeTeamInvite(inviteId);
  return c.json({ revoked: inviteId });
});

// POST /invites/:inviteId/accept — claim an invite addressed to my email
//
// Not under /:teamId: accepting is what makes you a member, so it can't sit
// behind requireMember. The invite id is the capability, and it only resolves
// for the email it was addressed to.
teams.post("/invites/:inviteId/accept", async (c) => {
  const user = c.get("user");
  const inviteId = c.req.param("inviteId");

  const invite = await db.getTeamInvite(inviteId);
  if (!invite) return c.json({ error: "Invite not found" }, 404);

  const ok = await db.acceptTeamInvite(inviteId, user.id, user.email);
  if (!ok) {
    return c.json({ error: "Invite is not claimable by this account" }, 403);
  }
  const team = await db.getTeam(invite.team_id);
  return c.json({
    team_id: invite.team_id,
    team_name: team?.name ?? null,
    role: invite.role,
  });
});

// ── Team-scoped token ────────────────────────────────────────────────────────

// POST /:teamId/token — mint the token lmthing.team presents to the team's pod
teams.post("/:teamId/token", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId);
  if (isResponse(membership)) return membership;

  const user = c.get("user");
  const { access_token, expires_at } = await signTeamToken(
    user.id,
    user.email,
    teamId,
    membership.role,
  );
  return c.json({ access_token, expires_at, role: membership.role });
});

// ── The team's pod ───────────────────────────────────────────────────────────
//
// Mirrors /api/compute/* but keyed on the team's principal and gated on
// membership. These take a PERSONAL token, like the rest of this router: they
// are control-plane operations about a team you belong to. The team-scoped token
// is for talking to the pod itself, through the edge.

/** Resolve the team's tier from LiteLLM metadata on its own principal. */
async function resolveTeamTier(teamId: string) {
  const key = teamPrincipalKey(teamId);
  try {
    const info = await litellm.getUserInfo(key);
    const tierName = info.user_info?.metadata?.tier || "free";
    return { tierName, tier: getTierByName(tierName) ?? TIERS.free };
  } catch {
    return { tierName: "free", tier: TIERS.free };
  }
}

// POST /:teamId/compute/ensure — provision or wake the team's pod
teams.post("/:teamId/compute/ensure", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId);
  if (isResponse(membership)) return membership;

  const { tierName, tier } = await resolveTeamTier(teamId);
  try {
    const connection = await ensurePod(teamPrincipal(teamId), tier.pod);
    const pod = await getPodStatus(teamPrincipal(teamId));
    return c.json({ ok: true, tier: tierName, podConfig: tier.pod, connection, pod });
  } catch (err) {
    console.error(`[teams] ensure pod failed for team ${teamId}:`, err);
    return c.json({ error: "Failed to provision team workspace" }, 500);
  }
});

// GET /:teamId/compute/status — the team pod's status
teams.get("/:teamId/compute/status", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId);
  if (isResponse(membership)) return membership;

  const { tierName, tier } = await resolveTeamTier(teamId);
  try {
    const pod = await getPodStatus(teamPrincipal(teamId));
    return c.json({ compute: true, tier: tierName, pod, podConfig: tier.pod });
  } catch (err) {
    console.error(`[teams] pod status failed for team ${teamId}:`, err);
    return c.json({
      compute: true,
      tier: tierName,
      pod: { exists: false, ready: false, phase: "error" },
      podConfig: tier.pod,
    });
  }
});

// POST /:teamId/compute/upgrade — rolling-restart onto the latest compute image
teams.post("/:teamId/compute/upgrade", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

  try {
    await restartPod(teamPrincipal(teamId));
    return c.json({ ok: true });
  } catch (err) {
    console.error(`[teams] restart failed for team ${teamId}:`, err);
    return c.json({ error: "Failed to restart team workspace" }, 500);
  }
});

// GET /:teamId/compute/env — the team's credentials. EDITOR ONLY: these are the
// team's provider tokens in plaintext, which a viewer has no business reading.
teams.get("/:teamId/compute/env", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

  try {
    const vars = await getEnvVars(teamPrincipal(teamId));
    return c.json({ vars });
  } catch (err) {
    console.error(`[teams] get env failed for team ${teamId}:`, err);
    return c.json({ error: "Failed to fetch env vars" }, 500);
  }
});

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// PUT /:teamId/compute/env — REPLACES every var and rolls the pod for everyone
// on the team; clients must GET+merge first.
teams.put("/:teamId/compute/env", async (c) => {
  const teamId = c.req.param("teamId");
  const membership = await requireMember(c, teamId, "editor");
  if (isResponse(membership)) return membership;

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
    if (!ENV_KEY_RE.test(k)) {
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
    await setEnvVars(teamPrincipal(teamId), validated);
    return c.json({ ok: true });
  } catch (err) {
    console.error(`[teams] set env failed for team ${teamId}:`, err);
    return c.json({ error: "Failed to update env vars" }, 500);
  }
});

export default teams;
