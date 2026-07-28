import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The push surface has two callers with two credentials, and the whole security
 * story is that they cannot be confused: a POD may ask for arbitrary users to be
 * notified (it holds a shared secret injected as a container env var), a USER may
 * only register and list their own devices (personal token).
 *
 * The other thing worth pinning is that an endpoint is never handed back out. It
 * is a capability to notify a device, and a settings page has no use for one.
 */

const savePushSubscription = vi.fn(async () => {});
const listPushSubscriptions = vi.fn(async () => [] as unknown[]);
const deletePushSubscription = vi.fn(async () => {});
const pushToUsers = vi.fn(async () => ({ sent: 1, failed: 0, pruned: 0 }));

vi.mock("../lib/db.js", () => ({
  savePushSubscription,
  listPushSubscriptions,
  deletePushSubscription,
}));
vi.mock("../lib/push.js", () => ({
  pushToUsers,
  pushConfigured: () => ({ web: true, expo: true }),
  vapidPublicKey: () => "PUBLIC_KEY",
}));
// The real middleware verifies a JWT against Zitadel; these tests are about the
// routes' own logic, so it stands in as "there is a signed-in user".
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", { id: "u-ana", email: "ana@example.com" });
    await next();
  },
}));

const { default: push } = await import("./push.js");

const POD_SECRET = "s3cret";

function req(path: string, init: RequestInit = {}) {
  return push.request(`http://local${path}`, init);
}
const json = (value: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(value),
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.POD_PUSH_SECRET = POD_SECRET;
});

describe("POST /send — the pod asking for members to be notified", () => {
  it("sends when the pod presents the shared secret", async () => {
    const res = await req("/send", {
      ...json({ teamId: "t1", userIds: ["u-bo"], title: "Ana Kay", body: "hi", url: "/team/t1" }),
      headers: { "content-type": "application/json", "x-lmthing-pod-secret": POD_SECRET },
    });
    expect(res.status).toBe(202);
    expect(pushToUsers).toHaveBeenCalledWith(
      ["u-bo"],
      expect.objectContaining({ title: "Ana Kay", body: "hi" }),
    );
  });

  it("refuses without the secret — a user token is NOT enough here", async () => {
    // This is the escalation that matters: `/send` reaches anybody's devices, so
    // being signed in must not be sufficient to call it.
    const res = await req("/send", json({ userIds: ["u-bo"], title: "hi" }));
    expect(res.status).toBe(403);
    expect(pushToUsers).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    const res = await req("/send", {
      ...json({ userIds: ["u-bo"], title: "hi" }),
      headers: { "content-type": "application/json", "x-lmthing-pod-secret": "wrong" },
    });
    expect(res.status).toBe(403);
  });

  it("refuses everything when the gateway has no secret configured", async () => {
    // An unprovisioned environment must fail closed, not open.
    delete process.env.POD_PUSH_SECRET;
    const res = await req("/send", {
      ...json({ userIds: ["u-bo"], title: "hi" }),
      headers: { "content-type": "application/json", "x-lmthing-pod-secret": "anything" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects a send that names nobody", async () => {
    const res = await req("/send", {
      ...json({ userIds: [], title: "hi" }),
      headers: { "content-type": "application/json", "x-lmthing-pod-secret": POD_SECRET },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /subscribe — a user registering their own device", () => {
  it("stores a web subscription against the signed-in user", async () => {
    const res = await req(
      "/subscribe",
      json({
        kind: "web",
        endpoint: "https://push.example/abc",
        keys: { p256dh: "k", auth: "a" },
        label: "Laptop",
      }),
    );
    expect(res.status).toBe(201);
    expect(savePushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-ana", kind: "web", endpoint: "https://push.example/abc" }),
    );
  });

  it("stores an expo subscription without keys", async () => {
    const res = await req("/subscribe", json({ kind: "expo", endpoint: "ExponentPushToken[xyz]" }));
    expect(res.status).toBe(201);
    expect(savePushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "expo", p256dh: null, auth: null }),
    );
  });

  it("refuses a web subscription with no keys, rather than storing a dead one", async () => {
    // Without the keys the payload cannot be encrypted, so it would be accepted
    // here and then fail silently on every single send.
    const res = await req("/subscribe", json({ kind: "web", endpoint: "https://push.example/abc" }));
    expect(res.status).toBe(400);
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it("refuses an unknown transport", async () => {
    const res = await req("/subscribe", json({ kind: "carrier-pigeon", endpoint: "x" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /devices", () => {
  it("never returns the endpoint — it is a capability, not a label", async () => {
    listPushSubscriptions.mockResolvedValueOnce([
      {
        id: "d1",
        user_id: "u-ana",
        kind: "web",
        endpoint: "https://push.example/SECRET",
        p256dh: "k",
        auth: "a",
        label: "Laptop",
        created_at: "2026-01-01",
        last_used_at: null,
      },
    ]);
    const res = await req("/devices");
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).not.toContain("SECRET");
    expect(JSON.parse(body).devices[0]).toMatchObject({ id: "d1", kind: "web", label: "Laptop" });
  });

  it("only ever asks for the signed-in user's own devices", async () => {
    await req("/devices");
    expect(listPushSubscriptions).toHaveBeenCalledWith(["u-ana"]);
  });
});

describe("GET /config", () => {
  it("publishes the VAPID public key, which a browser cannot subscribe without", async () => {
    const res = await req("/config");
    expect(await res.json()).toMatchObject({ vapidPublicKey: "PUBLIC_KEY", web: true });
  });
});
