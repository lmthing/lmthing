import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type {
  SocialAgent,
  SocialGroup,
  SocialGroupMember,
  SocialGroupMessage,
} from "../lib/db.js";

// The route pulls in the Postgres client (built from env at import time); mocking
// the db module keeps this a test of routing, auth, quotas and validation alone.
vi.mock("../lib/db.js", () => ({
  createSocialAgent: vi.fn(),
  getSocialAgentByHandle: vi.fn(async () => null),
  getSocialAgentBySecretHash: vi.fn(),
  listSocialAgents: vi.fn(async () => []),
  listSocialAgentMemberships: vi.fn(async () => []),
  listSocialAgentMessages: vi.fn(async () => []),
  touchSocialAgent: vi.fn(async () => undefined),
  createSocialGroup: vi.fn(),
  getSocialGroup: vi.fn(),
  listSocialGroups: vi.fn(async () => []),
  getSocialGroupMembership: vi.fn(async () => null),
  listSocialGroupMembers: vi.fn(async () => []),
  joinSocialGroup: vi.fn(),
  leaveSocialGroup: vi.fn(async () => true),
  closeSocialGroup: vi.fn(),
  addSocialGroupMessage: vi.fn(),
  getSocialMessage: vi.fn(),
  listSocialGroupMessages: vi.fn(async () => []),
  voteSocialMessage: vi.fn(async () => 1),
  getSocialQuotaUsage: vi.fn(async () => ({ groups: 0, messages: 0, votes: 0 })),
  getSocialStats: vi.fn(async () => ({
    agents: 0,
    groups: 0,
    open_groups: 0,
    messages: 0,
    votes: 0,
  })),
}));

const db = await import("../lib/db.js");
const { default: social } = await import("./social.js");

const app = new Hono().route("/api/social", social);

const AGENT: SocialAgent = {
  id: "agent-1",
  handle: "scout",
  secret_hash: "hash",
  model: "test-model",
  bio: null,
  karma: 7,
  created_at: "2026-01-01T00:00:00Z",
  last_seen_at: null,
};

const KEY = "Bearer sk_soc_testkey";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getSocialAgentBySecretHash).mockResolvedValue(AGENT);
  vi.mocked(db.touchSocialAgent).mockResolvedValue(undefined);
  vi.mocked(db.getSocialQuotaUsage).mockResolvedValue({ groups: 0, messages: 0, votes: 0 });
});

function call(
  path: string,
  init: { method?: string; body?: unknown; key?: string | null } = {},
) {
  const { method = "GET", body, key } = init;
  return app.request(`/api/social${path}`, {
    method,
    headers: {
      ...(key ? { Authorization: key } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function group(overrides: Partial<SocialGroup> = {}): SocialGroup {
  return {
    id: "g1",
    title: "Map the coastline",
    goal: "Produce a shared map of the API surface.",
    created_by: AGENT.id,
    status: "open",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function member(
  role: "founder" | "contributor",
  agentId = AGENT.id,
): SocialGroupMember {
  return {
    group_id: "g1",
    agent_id: agentId,
    handle: agentId === AGENT.id ? AGENT.handle : agentId,
    role,
    joined_at: "2026-01-01T00:00:00Z",
  };
}

function message(overrides: Partial<SocialGroupMessage> = {}): SocialGroupMessage {
  return {
    id: "m1",
    group_id: "g1",
    agent_id: "agent-2",
    handle: "other",
    kind: "message",
    body: "hi",
    score: 0,
    created_at: "2026-01-01T00:00:01Z",
    ...overrides,
  };
}

// ── public read surface ────────────────────────────────────────────────────────

describe("social — public reads need no key", () => {
  it("serves the constitution + live stats at GET /", async () => {
    const res = await call("");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { quotas: unknown; constitution: string[] };
    expect(body.quotas).toEqual({ groups: 3, messages: 60, votes: 120 });
    expect(Array.isArray(body.constitution)).toBe(true);
  });

  it("serves the feed with no Authorization header", async () => {
    const res = await call("/groups");
    expect(res.status).toBe(200);
    // callerId is null for the public feed — no per-agent role join.
    expect(vi.mocked(db.listSocialGroups)).toHaveBeenCalledWith(null, "open", NaN);
  });

  it("serves the leaderboard", async () => {
    const res = await call("/agents");
    expect(res.status).toBe(200);
  });

  it("404s an unknown agent profile", async () => {
    vi.mocked(db.getSocialAgentByHandle).mockResolvedValue(null);
    const res = await call("/agents/ghost");
    expect(res.status).toBe(404);
  });

  it("404s an unknown group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(null);
    const res = await call("/groups/nope");
    expect(res.status).toBe(404);
  });
});

// ── registration ────────────────────────────────────────────────────────────────

describe("social — self-registration", () => {
  it("registers an agent and returns the secret exactly once", async () => {
    vi.mocked(db.getSocialAgentByHandle).mockResolvedValue(null);
    vi.mocked(db.createSocialAgent).mockResolvedValue({
      id: "agent-9",
      handle: "mapper",
      model: "gpt-x",
      bio: null,
      karma: 0,
      created_at: "2026-01-01T00:00:00Z",
      last_seen_at: null,
    });
    const res = await call("/agents", {
      method: "POST",
      body: { handle: "Mapper", model: "gpt-x" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { handle: string; secret: string };
    expect(body.handle).toBe("mapper");
    expect(body.secret).toMatch(/^sk_soc_/);
    // Handle is lowercased before the row is written; only a hash is stored.
    const [handleArg, hashArg] = vi.mocked(db.createSocialAgent).mock.calls[0]!;
    expect(handleArg).toBe("mapper");
    expect(hashArg).not.toContain(body.secret);
    expect(hashArg).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a malformed handle", async () => {
    const res = await call("/agents", { method: "POST", body: { handle: "no" } });
    expect(res.status).toBe(400);
    expect(vi.mocked(db.createSocialAgent)).not.toHaveBeenCalled();
  });

  it("409s a taken handle", async () => {
    vi.mocked(db.getSocialAgentByHandle).mockResolvedValue({
      id: "x",
      handle: "scout",
      model: null,
      bio: null,
      karma: 0,
      created_at: "2026-01-01T00:00:00Z",
      last_seen_at: null,
    });
    const res = await call("/agents", { method: "POST", body: { handle: "scout" } });
    expect(res.status).toBe(409);
    expect(vi.mocked(db.createSocialAgent)).not.toHaveBeenCalled();
  });

  it("maps a lost unique-index race to 409", async () => {
    vi.mocked(db.getSocialAgentByHandle).mockResolvedValue(null);
    vi.mocked(db.createSocialAgent).mockRejectedValue({ code: "23505" });
    const res = await call("/agents", { method: "POST", body: { handle: "racer" } });
    expect(res.status).toBe(409);
  });
});

// ── auth on writes ──────────────────────────────────────────────────────────────

describe("social — writes require a valid key", () => {
  it("401 without a key", async () => {
    const res = await call("/groups", { method: "POST", body: { title: "t", goal: "g" } });
    expect(res.status).toBe(401);
  });

  it("401 with an unknown key", async () => {
    vi.mocked(db.getSocialAgentBySecretHash).mockResolvedValue(null);
    const res = await call("/groups", {
      method: "POST",
      body: { title: "t", goal: "g" },
      key: KEY,
    });
    expect(res.status).toBe(401);
  });
});

// ── groups ────────────────────────────────────────────────────────────────────

describe("social — creating a group", () => {
  it("creates it and seats the caller as founder", async () => {
    vi.mocked(db.createSocialGroup).mockResolvedValue(group());
    const res = await call("/groups", {
      method: "POST",
      body: { title: "  Map the coastline  ", goal: "  Produce a map.  " },
      key: KEY,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "g1", role: "founder" });
    expect(vi.mocked(db.createSocialGroup)).toHaveBeenCalledWith(
      "Map the coastline",
      "Produce a map.",
      AGENT.id,
      AGENT.handle,
    );
  });

  it("rejects a blank title before touching the db", async () => {
    const res = await call("/groups", {
      method: "POST",
      body: { title: "   ", goal: "g" },
      key: KEY,
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(db.createSocialGroup)).not.toHaveBeenCalled();
  });

  it("429s when the daily group quota is spent", async () => {
    vi.mocked(db.getSocialQuotaUsage).mockResolvedValue({ groups: 3, messages: 0, votes: 0 });
    const res = await call("/groups", {
      method: "POST",
      body: { title: "t", goal: "g" },
      key: KEY,
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ kind: "groups", limit: 3, used: 3 });
    expect(vi.mocked(db.createSocialGroup)).not.toHaveBeenCalled();
  });
});

describe("social — joining and leaving", () => {
  it("joins an open group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.joinSocialGroup).mockResolvedValue(member("contributor"));
    const res = await call("/groups/g1/join", { method: "POST", key: KEY });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.joinSocialGroup)).toHaveBeenCalledWith("g1", AGENT.id, AGENT.handle);
  });

  it("409s joining a closed group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group({ status: "closed" }));
    const res = await call("/groups/g1/join", { method: "POST", key: KEY });
    expect(res.status).toBe(409);
    expect(vi.mocked(db.joinSocialGroup)).not.toHaveBeenCalled();
  });

  it("lets a contributor leave", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.leaveSocialGroup).mockResolvedValue(true);
    const res = await call("/groups/g1/leave", { method: "POST", key: KEY });
    expect(res.status).toBe(200);
  });

  it("409s the founder trying to leave", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.leaveSocialGroup).mockResolvedValue(false);
    const res = await call("/groups/g1/leave", { method: "POST", key: KEY });
    expect(res.status).toBe(409);
  });
});

// ── the shared log ──────────────────────────────────────────────────────────────

describe("social — the shared log", () => {
  it("403s a post from a non-member", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(null);
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "hi" },
      key: KEY,
    });
    expect(res.status).toBe(403);
  });

  it("409s a post to a closed group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group({ status: "closed" }));
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "hi" },
      key: KEY,
    });
    expect(res.status).toBe(409);
  });

  it("429s when the daily message quota is spent", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    vi.mocked(db.getSocialQuotaUsage).mockResolvedValue({ groups: 0, messages: 60, votes: 0 });
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "hi" },
      key: KEY,
    });
    expect(res.status).toBe(429);
    expect(vi.mocked(db.addSocialGroupMessage)).not.toHaveBeenCalled();
  });

  it("stores a message, trimming it and defaulting an unknown kind", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    vi.mocked(db.addSocialGroupMessage).mockResolvedValue(message({ body: "found it" }));
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "  found it  ", kind: "nonsense" },
      key: KEY,
    });
    expect(res.status).toBe(200);
    // Handle comes from the membership row, never the client; bad kind → message.
    expect(vi.mocked(db.addSocialGroupMessage)).toHaveBeenCalledWith(
      "g1",
      AGENT.id,
      AGENT.handle,
      "message",
      "found it",
    );
  });

  it("keeps a valid kind like 'result'", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("founder"));
    vi.mocked(db.addSocialGroupMessage).mockResolvedValue(message());
    await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "the answer", kind: "result" },
      key: KEY,
    });
    expect(vi.mocked(db.addSocialGroupMessage)).toHaveBeenCalledWith(
      "g1",
      AGENT.id,
      AGENT.handle,
      "result",
      "the answer",
    );
  });
});

// ── closing ────────────────────────────────────────────────────────────────────

describe("social — closing", () => {
  it("lets the founder close", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("founder"));
    vi.mocked(db.closeSocialGroup).mockResolvedValue(group({ status: "closed" }));
    const res = await call("/groups/g1/close", { method: "POST", key: KEY });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "closed" });
  });

  it("403s a contributor", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    const res = await call("/groups/g1/close", { method: "POST", key: KEY });
    expect(res.status).toBe(403);
    expect(vi.mocked(db.closeSocialGroup)).not.toHaveBeenCalled();
  });

  it("is idempotent on an already-closed group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group({ status: "closed" }));
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("founder"));
    const res = await call("/groups/g1/close", { method: "POST", key: KEY });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.closeSocialGroup)).not.toHaveBeenCalled();
  });
});

// ── karma / voting ──────────────────────────────────────────────────────────────

describe("social — voting is karma", () => {
  it("records a vote and returns the new score", async () => {
    vi.mocked(db.getSocialMessage).mockResolvedValue(message({ agent_id: "agent-2" }));
    vi.mocked(db.voteSocialMessage).mockResolvedValue(3);
    const res = await call("/messages/m1/vote", {
      method: "POST",
      body: { value: 1 },
      key: KEY,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ message_id: "m1", value: 1, score: 3 });
    expect(vi.mocked(db.voteSocialMessage)).toHaveBeenCalledWith("m1", AGENT.id, "agent-2", 1);
  });

  it("403s voting on your own message", async () => {
    vi.mocked(db.getSocialMessage).mockResolvedValue(message({ agent_id: AGENT.id }));
    const res = await call("/messages/m1/vote", {
      method: "POST",
      body: { value: 1 },
      key: KEY,
    });
    expect(res.status).toBe(403);
    expect(vi.mocked(db.voteSocialMessage)).not.toHaveBeenCalled();
  });

  it("400s a bad vote value", async () => {
    vi.mocked(db.getSocialMessage).mockResolvedValue(message({ agent_id: "agent-2" }));
    const res = await call("/messages/m1/vote", {
      method: "POST",
      body: { value: 5 },
      key: KEY,
    });
    expect(res.status).toBe(400);
  });

  it("404s voting on a missing message", async () => {
    vi.mocked(db.getSocialMessage).mockResolvedValue(null);
    const res = await call("/messages/gone/vote", {
      method: "POST",
      body: { value: 1 },
      key: KEY,
    });
    expect(res.status).toBe(404);
  });

  it("429s a new vote when the daily vote quota is spent", async () => {
    vi.mocked(db.getSocialMessage).mockResolvedValue(message({ agent_id: "agent-2" }));
    vi.mocked(db.getSocialQuotaUsage).mockResolvedValue({ groups: 0, messages: 0, votes: 120 });
    const res = await call("/messages/m1/vote", {
      method: "POST",
      body: { value: 1 },
      key: KEY,
    });
    expect(res.status).toBe(429);
    expect(vi.mocked(db.voteSocialMessage)).not.toHaveBeenCalled();
  });

  it("lets a retraction (value 0) through even at quota — it frees, not spends", async () => {
    vi.mocked(db.getSocialMessage).mockResolvedValue(message({ agent_id: "agent-2" }));
    vi.mocked(db.getSocialQuotaUsage).mockResolvedValue({ groups: 0, messages: 0, votes: 120 });
    vi.mocked(db.voteSocialMessage).mockResolvedValue(0);
    const res = await call("/messages/m1/vote", {
      method: "POST",
      body: { value: 0 },
      key: KEY,
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.voteSocialMessage)).toHaveBeenCalledWith("m1", AGENT.id, "agent-2", 0);
  });
});

// ── /me ───────────────────────────────────────────────────────────────────────

describe("social — GET /me", () => {
  it("reports quota usage and what remains today", async () => {
    vi.mocked(db.getSocialQuotaUsage).mockResolvedValue({ groups: 1, messages: 10, votes: 4 });
    const res = await call("/me", { key: KEY });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      handle: "scout",
      karma: 7,
      used_today: { groups: 1, messages: 10, votes: 4 },
      remaining_today: { groups: 2, messages: 50, votes: 116 },
    });
  });
});
