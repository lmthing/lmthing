import { Hono } from "hono";
import * as db from "../lib/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { pushToUsers, pushConfigured, vapidPublicKey } from "../lib/push.js";
import type { Env } from "../types.js";

// ═══════════════════════════════════════════════════════════════
// PUSH — device registration, and the one way to reach those devices
// ═══════════════════════════════════════════════════════════════
//
// Two audiences with different credentials, which is why they are different
// routes rather than one with a mode flag:
//
//   /api/push/*      a USER registering their own device. Personal token.
//   /api/push/send   a POD asking for someone to be notified. Shared secret.
//
// The send route is the only way anything reaches a device, and it deliberately
// takes user IDS rather than endpoints: a caller never learns what devices
// somebody has, and cannot address one directly.

const push = new Hono<Env>();

/**
 * The pod's credential.
 *
 * Injected as a CONTAINER env var on team pods, never into the editable
 * `user-env` secret — an editor can rewrite that one wholesale with
 * `PUT /api/compute/env`, and a pod that could grant itself the ability to
 * notify arbitrary users would be a real escalation. Absent secret means the
 * route refuses everything, which is the safe direction for an unprovisioned
 * environment.
 */
function podAuthorized(header: string | undefined): boolean {
  const expected = process.env.POD_PUSH_SECRET;
  if (!expected || !header) return false;
  // Length-independent compare is not needed for a fixed-length shared secret
  // compared with ===, but the lengths must match before timingSafeEqual would
  // be usable at all; a simple compare is what every other in-cluster check here
  // does, and the value never reaches a browser.
  return header === expected;
}

/**
 * `POST /api/push/send` — the pod asking for members to be notified.
 *
 * Answers 202 whatever the transports do: the caller has already delivered the
 * message and raised the badges, and cannot act on a per-device failure.
 */
push.post("/send", async (c) => {
  if (!podAuthorized(c.req.header("x-lmthing-pod-secret"))) {
    return c.json({ error: "not authorized to send notifications" }, 403);
  }
  const body = await c.req.json<{
    teamId?: string;
    userIds?: string[];
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  }>().catch(() => null);
  if (!body?.userIds?.length || !body.title) {
    return c.json({ error: "userIds and title are required" }, 400);
  }

  const result = await pushToUsers(body.userIds, {
    title: body.title,
    body: body.body ?? "",
    url: body.url ?? "/team",
    tag: body.tag ?? body.teamId ?? "lmthing",
  });
  return c.json(result, 202);
});

// Everything below is a user acting on their own devices.
push.use("/subscribe", authMiddleware);
push.use("/unsubscribe", authMiddleware);
push.use("/devices", authMiddleware);

/**
 * `GET /api/push/config` — what a client needs before it can subscribe.
 *
 * Unauthenticated: the VAPID public key is public by construction (every browser
 * subscription embeds it) and a client has to have it before it can even ask the
 * user for permission. Telling it whether push is configured at all lets the UI
 * hide an option that cannot work rather than offering a button that fails.
 */
push.get("/config", (c) =>
  c.json({ vapidPublicKey: vapidPublicKey(), ...pushConfigured() }),
);

/**
 * `POST /api/push/subscribe` — register this device.
 *
 * Idempotent on the endpoint, so a client can call it on every launch without
 * accumulating rows (see `savePushSubscription`).
 */
push.post("/subscribe", async (c) => {
  const userId = c.get("user").id;
  const body = await c.req.json<{
    kind?: "web" | "expo";
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    label?: string;
  }>().catch(() => null);

  if (!body?.endpoint || (body.kind !== "web" && body.kind !== "expo")) {
    return c.json({ error: "kind ('web'|'expo') and endpoint are required" }, 400);
  }
  if (body.kind === "web" && (!body.keys?.p256dh || !body.keys.auth)) {
    // Without the keys the payload cannot be encrypted, so the subscription
    // would be stored and then silently fail on every send.
    return c.json({ error: "web subscriptions need keys.p256dh and keys.auth" }, 400);
  }

  await db.savePushSubscription({
    userId,
    kind: body.kind,
    endpoint: body.endpoint,
    p256dh: body.keys?.p256dh ?? null,
    auth: body.keys?.auth ?? null,
    label: body.label ?? null,
  });
  return c.json({ ok: true }, 201);
});

/** `POST /api/push/unsubscribe` — forget this device. */
push.post("/unsubscribe", async (c) => {
  const body = await c.req.json<{ endpoint?: string }>().catch(() => null);
  if (!body?.endpoint) return c.json({ error: "endpoint is required" }, 400);
  await db.deletePushSubscription(body.endpoint);
  return c.json({ ok: true });
});

/** `GET /api/push/devices` — what this user has registered, for a settings UI. */
push.get("/devices", async (c) => {
  const subs = await db.listPushSubscriptions([c.get("user").id]);
  return c.json({
    devices: subs.map((s) => ({
      // Never the endpoint itself: it is a capability to notify that device, and
      // a settings page has no use for one.
      id: s.id,
      kind: s.kind,
      label: s.label,
      created_at: s.created_at,
      last_used_at: s.last_used_at,
    })),
  });
});

export default push;
