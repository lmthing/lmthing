import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { signTokens } from "../lib/tokens.js";
import type {
  SocialGroup,
  SocialGroupMember,
  SocialGroupMessage,
} from "../lib/db.js";

// The route pulls in the Postgres client (constructed from env at import time);
// mocking the db module keeps this a test of routing + authorization + validation.
vi.mock("../lib/db.js", () => ({
  createSocialGroup: vi.fn(),
  getSocialGroup: vi.fn(),
  listSocialGroups: vi.fn(async () => []),
  getSocialGroupMembership: vi.fn(async () => null),
  listSocialGroupMembers: vi.fn(async () => []),
  joinSocialGroup: vi.fn(),
  leaveSocialGroup: vi.fn(async () => true),
  addSocialGroupMessage: vi.fn(),
  listSocialGroupMessages: vi.fn(async () => []),
  closeSocialGroup: vi.fn(),
}));

const db = await import("../lib/db.js");
const { default: social } = await import("./social.js");

const app = new Hono().route("/api/social", social);

const CALLER = { id: "agent-1", email: "scout@agents.test" };
let authHeader: string;

beforeEach(async () => {
  vi.clearAllMocks();
  const { access_token } = await signTokens(CALLER.id, CALLER.email);
  authHeader = `Bearer ${access_token}`;
});

function group(overrides: Partial<SocialGroup> = {}): SocialGroup {
  return {
    id: "g1",
    title: "Map the coastline",
    goal: "Produce a shared map of the reachable API surface.",
    created_by: CALLER.id,
    status: "open",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function member(
  role: "founder" | "contributor",
  agentId = CALLER.id,
): SocialGroupMember {
  return {
    group_id: "g1",
    agent_id: agentId,
    handle: agentId === CALLER.id ? "scout" : agentId,
    role,
    joined_at: "2026-01-01T00:00:00Z",
  };
}

function call(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
) {
  const { method = "GET", body, auth = true } = init;
  return app.request(`/api/social${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: authHeader } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("social routes — authentication", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await call("/groups", { auth: false });
    expect(res.status).toBe(401);
  });
});

describe("social routes — creating a group", () => {
  it("creates a group and seats the caller as founder, deriving its handle", async () => {
    vi.mocked(db.createSocialGroup).mockResolvedValue(group());
    const res = await call("/groups", {
      method: "POST",
      body: { title: "  Map the coastline  ", goal: "  Produce a shared map.  " },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "g1", role: "founder" });
    // Title/goal are trimmed; the handle is the local part of the email.
    expect(vi.mocked(db.createSocialGroup)).toHaveBeenCalledWith(
      "Map the coastline",
      "Produce a shared map.",
      CALLER.id,
      "scout",
    );
  });

  it("rejects a blank title", async () => {
    const res = await call("/groups", {
      method: "POST",
      body: { title: "   ", goal: "something" },
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(db.createSocialGroup)).not.toHaveBeenCalled();
  });

  it("rejects a missing goal", async () => {
    const res = await call("/groups", { method: "POST", body: { title: "x" } });
    expect(res.status).toBe(400);
    expect(vi.mocked(db.createSocialGroup)).not.toHaveBeenCalled();
  });
});

describe("social routes — the feed", () => {
  it("defaults to open groups and passes a bad limit through as a default", async () => {
    const res = await call("/groups?limit=abc");
    expect(res.status).toBe(200);
    expect(vi.mocked(db.listSocialGroups)).toHaveBeenCalledWith(
      CALLER.id,
      "open",
      NaN,
    );
  });

  it("honours ?status=all", async () => {
    await call("/groups?status=all&limit=5");
    expect(vi.mocked(db.listSocialGroups)).toHaveBeenCalledWith(CALLER.id, "all", 5);
  });

  it("clamps an unknown status back to open", async () => {
    await call("/groups?status=bogus");
    expect(vi.mocked(db.listSocialGroups)).toHaveBeenCalledWith(
      CALLER.id,
      "open",
      NaN,
    );
  });
});

describe("social routes — reading one group", () => {
  it("returns 404 for a group that does not exist", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(null);
    const res = await call("/groups/nope");
    expect(res.status).toBe(404);
  });

  it("returns the group, roster and the caller's role", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.listSocialGroupMembers).mockResolvedValue([member("founder")]);
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("founder"));
    const res = await call("/groups/g1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "g1",
      role: "founder",
      members: [{ agent_id: CALLER.id, role: "founder" }],
    });
  });

  it("reports role:null for a non-member reading a group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(null);
    const res = await call("/groups/g1");
    expect(await res.json()).toMatchObject({ role: null });
  });
});

describe("social routes — joining and leaving", () => {
  it("joins an open group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.joinSocialGroup).mockResolvedValue(member("contributor"));
    const res = await call("/groups/g1/join", { method: "POST" });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.joinSocialGroup)).toHaveBeenCalledWith("g1", CALLER.id, "scout");
  });

  it("refuses to join a closed group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group({ status: "closed" }));
    const res = await call("/groups/g1/join", { method: "POST" });
    expect(res.status).toBe(409);
    expect(vi.mocked(db.joinSocialGroup)).not.toHaveBeenCalled();
  });

  it("lets a contributor leave", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.leaveSocialGroup).mockResolvedValue(true);
    const res = await call("/groups/g1/leave", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ left: true });
  });

  it("refuses to let the founder leave (409)", async () => {
    // leaveSocialGroup returns false for the founder — the route maps that to 409.
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.leaveSocialGroup).mockResolvedValue(false);
    const res = await call("/groups/g1/leave", { method: "POST" });
    expect(res.status).toBe(409);
  });
});

describe("social routes — the shared log", () => {
  it("reads the log with an ?after cursor and limit", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.listSocialGroupMessages).mockResolvedValue([]);
    await call("/groups/g1/messages?after=2026-01-01T00:00:00Z&limit=10");
    expect(vi.mocked(db.listSocialGroupMessages)).toHaveBeenCalledWith(
      "g1",
      10,
      "2026-01-01T00:00:00Z",
    );
  });

  it("refuses a post from a non-member with 403", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(null);
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "hello" },
    });
    expect(res.status).toBe(403);
    expect(vi.mocked(db.addSocialGroupMessage)).not.toHaveBeenCalled();
  });

  it("refuses a post to a closed group with 409", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group({ status: "closed" }));
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "hello" },
    });
    expect(res.status).toBe(409);
  });

  it("stores a member's message, defaulting an unknown kind to 'message'", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    const stored: SocialGroupMessage = {
      id: "m1",
      group_id: "g1",
      agent_id: CALLER.id,
      handle: "scout",
      kind: "message",
      body: "found it",
      created_at: "2026-01-01T00:00:01Z",
    };
    vi.mocked(db.addSocialGroupMessage).mockResolvedValue(stored);
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "  found it  ", kind: "nonsense" },
    });
    expect(res.status).toBe(200);
    // Body trimmed; the handle comes from the membership row, never the client;
    // the bogus kind falls back to "message".
    expect(vi.mocked(db.addSocialGroupMessage)).toHaveBeenCalledWith(
      "g1",
      CALLER.id,
      "scout",
      "message",
      "found it",
    );
  });

  it("keeps a valid kind such as 'result'", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("founder"));
    vi.mocked(db.addSocialGroupMessage).mockResolvedValue({} as SocialGroupMessage);
    await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "the answer", kind: "result" },
    });
    expect(vi.mocked(db.addSocialGroupMessage)).toHaveBeenCalledWith(
      "g1",
      CALLER.id,
      "scout",
      "result",
      "the answer",
    );
  });

  it("rejects a blank body", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    const res = await call("/groups/g1/messages", {
      method: "POST",
      body: { body: "   " },
    });
    expect(res.status).toBe(400);
  });
});

describe("social routes — closing", () => {
  it("lets the founder close the group", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("founder"));
    vi.mocked(db.closeSocialGroup).mockResolvedValue(group({ status: "closed" }));
    const res = await call("/groups/g1/close", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "closed" });
  });

  it("refuses to close for a contributor (403)", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group());
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("contributor"));
    const res = await call("/groups/g1/close", { method: "POST" });
    expect(res.status).toBe(403);
    expect(vi.mocked(db.closeSocialGroup)).not.toHaveBeenCalled();
  });

  it("is idempotent — closing an already-closed group returns it", async () => {
    vi.mocked(db.getSocialGroup).mockResolvedValue(group({ status: "closed" }));
    vi.mocked(db.getSocialGroupMembership).mockResolvedValue(member("founder"));
    const res = await call("/groups/g1/close", { method: "POST" });
    expect(res.status).toBe(200);
    expect(vi.mocked(db.closeSocialGroup)).not.toHaveBeenCalled();
  });
});
