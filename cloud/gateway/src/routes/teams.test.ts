import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { signTokens, verifyTeamToken } from "../lib/tokens.js";
import type { TeamMember, TeamRole } from "../lib/db.js";

// The route module pulls in Postgres/Stripe/LiteLLM/Zitadel clients that all
// construct themselves from env at import time; mocking the modules keeps this a
// test of the routing and authorization rules alone.
vi.mock("../lib/db.js", () => ({
  getTeamMembership: vi.fn(),
  getTeam: vi.fn(),
  createTeam: vi.fn(),
  listTeamsForUser: vi.fn(async () => []),
  listTeamMembers: vi.fn(async () => []),
  listTeamInvites: vi.fn(async () => []),
  updateTeamMemberRole: vi.fn(),
  removeTeamMember: vi.fn(),
  upsertTeamInvite: vi.fn(),
  getTeamInvite: vi.fn(),
  acceptTeamInvite: vi.fn(),
  listPendingInvitesForEmail: vi.fn(async () => []),
  // Void helpers must still hand back a promise — routes chain .catch() on them.
  setTeamName: vi.fn(async () => undefined),
  setTeamStripeCustomer: vi.fn(async () => undefined),
  upsertTeamMember: vi.fn(async () => undefined),
  revokeTeamInvite: vi.fn(async () => undefined),
}));
vi.mock("../lib/stripe.js", () => ({
  stripe: { customers: { create: vi.fn(async () => ({ id: "cus_test" })) } },
}));
vi.mock("../lib/litellm.js", () => ({ createUser: vi.fn(async () => ({})) }));
vi.mock("../lib/zitadel.js", () => ({ getUserByEmail: vi.fn() }));
vi.mock("../lib/email.js", () => ({
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn(async () => undefined),
}));

const db = await import("../lib/db.js");
const zitadel = await import("../lib/zitadel.js");
const email = await import("../lib/email.js");
const litellm = await import("../lib/litellm.js");
const { default: teams } = await import("./teams.js");

const app = new Hono().route("/api/teams", teams);

const CALLER = { id: "user-1", email: "caller@example.com" };
let authHeader: string;

beforeEach(async () => {
  vi.clearAllMocks();
  // `clearAllMocks` clears calls but KEEPS implementations, so the "no mailer"
  // case below would otherwise leak `false` into every test declared after it.
  vi.mocked(email.isEmailConfigured).mockReturnValue(true);
  vi.mocked(email.sendEmail).mockResolvedValue(undefined);
  const { access_token } = await signTokens(CALLER.id, CALLER.email);
  authHeader = `Bearer ${access_token}`;
});

function member(role: TeamRole, userId = CALLER.id): TeamMember {
  return {
    team_id: "t1",
    user_id: userId,
    email: userId === CALLER.id ? CALLER.email : `${userId}@example.com`,
    role,
    invited_by: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

/** Call a team route as the authenticated caller. */
function call(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
) {
  const { method = "GET", body, auth = true } = init;
  return app.request(`/api/teams${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: authHeader } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("teams routes — authentication", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await call("", { auth: false });
    expect(res.status).toBe(401);
  });

  it("lists the caller's teams and the invites addressed to them", async () => {
    vi.mocked(db.listTeamsForUser).mockResolvedValue([
      {
        id: "t1",
        name: "Acme",
        created_by: "user-9",
        stripe_customer_id: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        role: "viewer",
      },
    ]);
    vi.mocked(db.listPendingInvitesForEmail).mockResolvedValue([
      {
        id: "i1",
        team_id: "t2",
        team_name: "Other",
        email: CALLER.email,
        role: "editor",
        invited_by: "user-9",
        expires_at: "2099-01-01T00:00:00Z",
        accepted_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const res = await call("");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      teams: [{ id: "t1", role: "viewer" }],
      invites: [{ id: "i1", team_name: "Other", role: "editor" }],
    });
  });
});

describe("teams routes — membership gating", () => {
  it("hides a team from a non-member as 404, not 403", async () => {
    // A team id must not be probeable for existence.
    vi.mocked(db.getTeamMembership).mockResolvedValue(null);
    const res = await call("/t1");
    expect(res.status).toBe(404);
    expect(vi.mocked(db.getTeam)).not.toHaveBeenCalled();
  });

  it("lets a viewer read the team", async () => {
    vi.mocked(db.getTeamMembership).mockResolvedValue(member("viewer"));
    vi.mocked(db.getTeam).mockResolvedValue({
      id: "t1",
      name: "Acme",
      created_by: "user-9",
      stripe_customer_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    vi.mocked(db.listTeamMembers).mockResolvedValue([member("viewer")]);
    vi.mocked(db.listTeamInvites).mockResolvedValue([]);

    const res = await call("/t1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Acme", role: "viewer" });
  });

  it.each([
    ["PUT", "/t1", { name: "Renamed" }],
    ["POST", "/t1/members", { email: "b@example.com", role: "viewer" }],
    ["PUT", "/t1/members/user-2", { role: "editor" }],
    ["DELETE", "/t1/members/user-2", undefined],
    ["DELETE", "/t1/invites/i1", undefined],
  ])("refuses %s %s for a viewer", async (method, path, body) => {
    vi.mocked(db.getTeamMembership).mockResolvedValue(member("viewer"));
    const res = await call(path, { method, body });
    expect(res.status).toBe(403);
  });

  it("lets a member leave the team themselves", async () => {
    // Leaving is your own right even as a viewer — the editor gate applies only
    // to removing someone else.
    vi.mocked(db.getTeamMembership).mockResolvedValue(member("viewer"));
    vi.mocked(db.removeTeamMember).mockResolvedValue(true);
    const res = await call(`/t1/members/${CALLER.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.removeTeamMember)).toHaveBeenCalledWith("t1", CALLER.id);
  });
});

describe("teams routes — membership changes", () => {
  beforeEach(() => {
    vi.mocked(db.getTeamMembership).mockResolvedValue(member("editor"));
  });

  it("adds an existing account as a member", async () => {
    vi.mocked(zitadel.getUserByEmail).mockResolvedValue({
      id: "user-2",
      email: "b@example.com",
    });
    const res = await call("/t1/members", {
      method: "POST",
      body: { email: "B@Example.com", role: "editor" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "added",
      user_id: "user-2",
    });
    expect(vi.mocked(db.upsertTeamMember)).toHaveBeenCalledWith(
      "t1",
      "user-2",
      "b@example.com", // normalized to lowercase
      "editor",
      CALLER.id,
    );
  });

  it("records an invite when the email has no account yet", async () => {
    vi.mocked(zitadel.getUserByEmail).mockRejectedValue(new Error("not found"));
    vi.mocked(db.upsertTeamInvite).mockResolvedValue({
      id: "i1",
      team_id: "t1",
      email: "new@example.com",
      role: "viewer",
      invited_by: CALLER.id,
      expires_at: "2026-02-01T00:00:00Z",
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    const res = await call("/t1/members", {
      method: "POST",
      body: { email: "new@example.com" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "invited",
      invite_id: "i1",
      role: "viewer", // defaults to the least privilege
    });
  });

  it("rejects an unknown role", async () => {
    const res = await call("/t1/members", {
      method: "POST",
      body: { email: "b@example.com", role: "admin" },
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(db.upsertTeamMember)).not.toHaveBeenCalled();
    // Nothing happened, so nobody should be told anything happened.
    expect(vi.mocked(email.sendEmail)).not.toHaveBeenCalled();
  });

  // ── telling the invitee ────────────────────────────────────────────────────
  //
  // An invite nobody is told about is not an invite. Before this the inviter had
  // to share the link by hand, which the route's own comment admitted.

  it("emails someone who has no account, telling them how to claim it", async () => {
    vi.mocked(zitadel.getUserByEmail).mockRejectedValue(new Error("not found"));
    vi.mocked(db.getTeam).mockResolvedValue({
      id: "t1",
      name: "Acme",
      owner_id: CALLER.id,
      stripe_customer_id: null,
      tier: "free",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    } as never);
    vi.mocked(db.upsertTeamInvite).mockResolvedValue({
      id: "i1",
      team_id: "t1",
      email: "new@example.com",
      role: "viewer",
      invited_by: CALLER.id,
      expires_at: "2026-02-01T00:00:00Z",
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    });

    const res = await call("/t1/members", {
      method: "POST",
      body: { email: "new@example.com" },
    });
    expect(await res.json()).toMatchObject({ status: "invited", emailed: true });

    const sent = vi.mocked(email.sendEmail).mock.calls[0]![0];
    expect(sent.to).toBe("new@example.com");
    expect(sent.subject).toContain("Acme");
    expect(sent.subject).toContain(CALLER.email);
    // The claim is made by signing in with the address — if the mail does not say
    // so, a recipient with no account has no idea what is being asked of them.
    expect(sent.text).toContain("sign in with this email address");
    expect(sent.text).toContain("https://lmthing.team/team");
  });

  it("tells an existing account it was ADDED, not that it must accept", async () => {
    vi.mocked(zitadel.getUserByEmail).mockResolvedValue({
      id: "user-2",
      email: "b@example.com",
    });
    vi.mocked(db.getTeam).mockResolvedValue({ id: "t1", name: "Acme" } as never);

    const res = await call("/t1/members", {
      method: "POST",
      body: { email: "b@example.com", role: "editor" },
    });
    expect(await res.json()).toMatchObject({ status: "added", emailed: true });

    const sent = vi.mocked(email.sendEmail).mock.calls[0]![0];
    expect(sent.subject).toContain("added to Acme");
    // They are already a member; telling them to accept an invite sends them
    // hunting for a button that is not there.
    expect(sent.text).not.toContain("accept");
    expect(sent.text).toContain("already on your account");
  });

  it("escapes a team name so an inviter cannot inject markup into the mail", async () => {
    vi.mocked(zitadel.getUserByEmail).mockRejectedValue(new Error("not found"));
    vi.mocked(db.getTeam).mockResolvedValue({
      id: "t1",
      name: '<img src=x onerror="alert(1)">',
    } as never);
    vi.mocked(db.upsertTeamInvite).mockResolvedValue({
      id: "i1",
      team_id: "t1",
      email: "new@example.com",
      role: "viewer",
      invited_by: CALLER.id,
      expires_at: null,
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    } as never);

    await call("/t1/members", { method: "POST", body: { email: "new@example.com" } });
    const sent = vi.mocked(email.sendEmail).mock.calls[0]![0];
    expect(sent.html).not.toContain("<img");
    expect(sent.html).toContain("&lt;img");
  });

  it("a dead relay does not lose the invite — it reports emailed:false", async () => {
    // The row is already committed and is claimable by signing in, so failing the
    // request would invite a retry that re-sends rather than fixing anything.
    vi.mocked(zitadel.getUserByEmail).mockRejectedValue(new Error("not found"));
    vi.mocked(db.getTeam).mockResolvedValue({ id: "t1", name: "Acme" } as never);
    vi.mocked(db.upsertTeamInvite).mockResolvedValue({
      id: "i1",
      team_id: "t1",
      email: "new@example.com",
      role: "viewer",
      invited_by: CALLER.id,
      expires_at: null,
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    } as never);
    vi.mocked(email.sendEmail).mockRejectedValueOnce(new Error("relay down"));

    const res = await call("/t1/members", {
      method: "POST",
      body: { email: "new@example.com" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "invited", invite_id: "i1", emailed: false });
  });

  it("a deployment with no mailer still invites, and says it did not send", async () => {
    vi.mocked(email.isEmailConfigured).mockReturnValue(false);
    vi.mocked(zitadel.getUserByEmail).mockRejectedValue(new Error("not found"));
    vi.mocked(db.getTeam).mockResolvedValue({ id: "t1", name: "Acme" } as never);
    vi.mocked(db.upsertTeamInvite).mockResolvedValue({
      id: "i1",
      team_id: "t1",
      email: "new@example.com",
      role: "viewer",
      invited_by: CALLER.id,
      expires_at: null,
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    } as never);

    const res = await call("/t1/members", {
      method: "POST",
      body: { email: "new@example.com" },
    });
    expect(await res.json()).toMatchObject({ status: "invited", emailed: false });
    expect(vi.mocked(email.sendEmail)).not.toHaveBeenCalled();
  });

  it("reports the last-editor guard as a conflict", async () => {
    // A team with only viewers could never be configured or billed again.
    vi.mocked(db.getTeamMembership).mockResolvedValue(member("editor"));
    vi.mocked(db.updateTeamMemberRole).mockResolvedValue(false);
    const res = await call(`/t1/members/${CALLER.id}`, {
      method: "PUT",
      body: { role: "viewer" },
    });
    expect(res.status).toBe(409);
  });
});

describe("teams routes — invites", () => {
  it("accepts an invite addressed to the caller", async () => {
    vi.mocked(db.getTeamInvite).mockResolvedValue({
      id: "i1",
      team_id: "t1",
      email: CALLER.email,
      role: "viewer",
      invited_by: "user-9",
      expires_at: "2099-01-01T00:00:00Z",
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    vi.mocked(db.acceptTeamInvite).mockResolvedValue(true);
    vi.mocked(db.getTeam).mockResolvedValue({
      id: "t1",
      name: "Acme",
      created_by: "user-9",
      stripe_customer_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    const res = await call("/invites/i1/accept", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ team_id: "t1", role: "viewer" });
    expect(vi.mocked(db.acceptTeamInvite)).toHaveBeenCalledWith(
      "i1",
      CALLER.id,
      CALLER.email,
    );
  });

  it("refuses an invite addressed to someone else", async () => {
    vi.mocked(db.getTeamInvite).mockResolvedValue({
      id: "i1",
      team_id: "t1",
      email: "someone-else@example.com",
      role: "editor",
      invited_by: "user-9",
      expires_at: "2099-01-01T00:00:00Z",
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    // The addressee check lives in the DB transaction, which returns false.
    vi.mocked(db.acceptTeamInvite).mockResolvedValue(false);
    const res = await call("/invites/i1/accept", { method: "POST" });
    expect(res.status).toBe(403);
  });
});

describe("teams routes — token mint", () => {
  it("mints a team token carrying the caller's current role", async () => {
    vi.mocked(db.getTeamMembership).mockResolvedValue(member("viewer"));
    const res = await call("/t1/token", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { access_token: string; role: string };
    expect(body.role).toBe("viewer");
    // The role Envoy will project into x-lmthing-role comes from the DB at mint
    // time, never from the client.
    expect(await verifyTeamToken(body.access_token)).toMatchObject({
      userId: CALLER.id,
      teamId: "t1",
      role: "viewer",
    });
  });

  it("refuses to mint for a non-member", async () => {
    vi.mocked(db.getTeamMembership).mockResolvedValue(null);
    const res = await call("/t1/token", { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("teams routes — creation", () => {
  it("creates the team, then gives it its own billing and LLM principal", async () => {
    vi.mocked(db.createTeam).mockResolvedValue({
      id: "t-new",
      name: "Acme",
      created_by: CALLER.id,
      stripe_customer_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    const res = await call("", { method: "POST", body: { name: "  Acme  " } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "t-new", role: "editor" });

    expect(vi.mocked(db.createTeam)).toHaveBeenCalledWith(
      "Acme",
      CALLER.id,
      CALLER.email,
      null,
    );
    // The LiteLLM principal is the team, never the creator — nothing a team
    // spends is billed to a member.
    expect(vi.mocked(litellm.createUser)).toHaveBeenCalledWith(
      "team-t-new",
      expect.objectContaining({ name: expect.any(String) }),
      expect.objectContaining({ team_id: "t-new" }),
    );
    expect(vi.mocked(db.setTeamStripeCustomer)).toHaveBeenCalledWith(
      "t-new",
      "cus_test",
    );
  });

  it("rejects a blank name", async () => {
    const res = await call("", { method: "POST", body: { name: "   " } });
    expect(res.status).toBe(400);
    expect(vi.mocked(db.createTeam)).not.toHaveBeenCalled();
  });
});
