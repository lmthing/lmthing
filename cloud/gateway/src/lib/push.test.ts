import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The delivery layer's real decisions: which transport a device gets, that Expo
 * is addressed in ONE batched request rather than one per token, and — the part
 * that costs money if it is wrong — that a device which is gone is DELETED
 * rather than retried forever.
 *
 * The transports themselves are stubbed. What they do on the wire is theirs;
 * what this module does with their answers is ours.
 */

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

const listPushSubscriptions = vi.fn();
const deletePushSubscription = vi.fn(async () => {});
const touchPushSubscriptions = vi.fn(async () => {});
vi.mock("./db.js", () => ({
  listPushSubscriptions: (...a: unknown[]) => listPushSubscriptions(...a),
  deletePushSubscription: (...a: unknown[]) => deletePushSubscription(...a),
  touchPushSubscriptions: (...a: unknown[]) => touchPushSubscriptions(...a),
}));

const { pushToUsers } = await import("./push.js");

const MESSAGE = { title: "Ana Kay", body: "hi", url: "/team/t1", tag: "t1:general" };

const webSub = (endpoint: string) => ({
  id: endpoint,
  user_id: "u-bo",
  kind: "web" as const,
  endpoint,
  p256dh: "k",
  auth: "a",
  label: null,
  created_at: "",
  last_used_at: null,
});
const expoSub = (endpoint: string) => ({
  ...webSub(endpoint),
  kind: "expo" as const,
  p256dh: null,
  auth: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  vi.stubGlobal("fetch", vi.fn());
});

describe("pushToUsers", () => {
  it("does nothing, and calls nothing, when a user has no devices", async () => {
    listPushSubscriptions.mockResolvedValueOnce([]);
    expect(await pushToUsers(["u-bo"], MESSAGE)).toEqual({ sent: 0, failed: 0, pruned: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a web device through Web Push, encrypted to its own keys", async () => {
    listPushSubscriptions.mockResolvedValueOnce([webSub("https://push.example/a")]);
    sendNotification.mockResolvedValueOnce({});
    const result = await pushToUsers(["u-bo"], MESSAGE);
    expect(result.sent).toBe(1);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example/a",
        keys: { p256dh: "k", auth: "a" },
      }),
      JSON.stringify(MESSAGE),
      expect.anything(),
    );
  });

  it("deletes a web endpoint the browser has revoked (410), instead of retrying it", async () => {
    listPushSubscriptions.mockResolvedValueOnce([webSub("https://push.example/gone")]);
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
    const result = await pushToUsers(["u-bo"], MESSAGE);
    expect(result).toMatchObject({ sent: 0, pruned: 1 });
    expect(deletePushSubscription).toHaveBeenCalledWith("https://push.example/gone");
  });

  it("keeps an endpoint that merely failed — a 500 is the service's problem, not the device's", async () => {
    listPushSubscriptions.mockResolvedValueOnce([webSub("https://push.example/flaky")]);
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    const result = await pushToUsers(["u-bo"], MESSAGE);
    expect(result).toMatchObject({ failed: 1, pruned: 0 });
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it("addresses every Expo device in ONE request, not one each", async () => {
    // Expo's documented interface takes a batch, and per-token requests get rate
    // limited — so this is correctness, not an optimisation.
    listPushSubscriptions.mockResolvedValueOnce([expoSub("ExponentPushToken[a]"), expoSub("ExponentPushToken[b]")]);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }, { status: "ok" }] }),
    });
    const result = await pushToUsers(["u-bo"], MESSAGE);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(2);
    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ to: "ExponentPushToken[a]", title: "Ana Kay", collapseId: "t1:general" });
  });

  it("prunes the Expo token Expo says is not registered — positionally", async () => {
    // Expo answers one ticket per token in the order sent, so mapping the wrong
    // ticket to the wrong device would delete a live one and keep a dead one.
    listPushSubscriptions.mockResolvedValueOnce([expoSub("ExponentPushToken[live]"), expoSub("ExponentPushToken[dead]")]);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }],
      }),
    });
    const result = await pushToUsers(["u-bo"], MESSAGE);
    expect(result).toMatchObject({ sent: 1, pruned: 1 });
    expect(deletePushSubscription).toHaveBeenCalledExactlyOnceWith("ExponentPushToken[dead]");
  });

  it("reaches a member's phone AND their laptop from one call", async () => {
    listPushSubscriptions.mockResolvedValueOnce([webSub("https://push.example/laptop"), expoSub("ExponentPushToken[phone]")]);
    sendNotification.mockResolvedValueOnce({});
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }] }),
    });
    expect((await pushToUsers(["u-bo"], MESSAGE)).sent).toBe(2);
  });

  it("does not attempt Web Push at all without VAPID credentials", async () => {
    // An unprovisioned environment must degrade to "no notifications", never to
    // a crash on the message path that asked for one.
    vi.resetModules();
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const fresh = await import("./push.js");
    listPushSubscriptions.mockResolvedValueOnce([webSub("https://push.example/a")]);
    const result = await fresh.pushToUsers(["u-bo"], MESSAGE);
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
