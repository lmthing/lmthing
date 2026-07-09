import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { signInboundToken, verifyInboundToken } from "../lib/tokens.js";
import { listWebhookBindings } from "../lib/db.js";
import {
  getPodInternalBaseUrl,
  wakeUserPod,
  resolvePodConfig,
  waitForPodReady,
} from "../lib/compute.js";
import type { Env } from "../types.js";

const inbound = new Hono<Env>();

/** Our public inbound-webhook base URL, mirroring connections.ts's redirectUri(). */
function baseUrl(): string {
  return (process.env.BASE_URL ?? "").replace(/\/+$/, "");
}

// Bounded wait for a woken pod before we fire the forward — modest, since we
// still owe the external caller a fast response (unlike /ensure, which serves
// a browser that's already waiting on the pod).
const INBOUND_WAKE_WAIT_MS = Number(process.env.INBOUND_WAKE_WAIT_MS) || 4_000;

// Headers safe to relay into the pod: content-type (body framing) and any
// provider signature/delivery headers (GitHub's X-Hub-Signature-256, Stripe-
// style X-* headers, etc). Everything else (Host, Authorization, our own
// routing headers) is dropped rather than forwarded blind.
function forwardHeaders(source: Headers): Headers {
  const out = new Headers();
  const ct = source.get("content-type");
  if (ct) out.set("content-type", ct);
  for (const [key, value] of source.entries()) {
    if (key.toLowerCase().startsWith("x-")) out.set(key, value);
  }
  return out;
}

// GET / — the caller's inbound base info for the UI: the broker URL to hand to
// external providers, the long-lived token embedded in it, and the bindings
// the pod has published (empty until the pod's first webhook-manifest push).
inbound.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  try {
    const token = await signInboundToken(user.id);
    const bindings = await listWebhookBindings(user.id);
    return c.json({
      baseUrl: `${baseUrl()}/api/inbound/${token}`,
      token,
      bindings,
    });
  } catch (err) {
    console.error(`Failed to build inbound info for ${user.id}:`, err);
    return c.json({ error: "Failed to load inbound webhook info" }, 500);
  }
});

// POST /:userToken/:path — the public broker endpoint external providers POST
// to. No authMiddleware — the long-lived `userToken` (aud:"inbound") IS the
// auth, mirroring the connections `/callback` and the Stripe webhook. Wakes
// the pod, forwards the request in (fire-and-forget — we do not wait for the
// pod to finish handling it), and returns 202 immediately so the provider
// never times out waiting on agent/hook execution.
inbound.post("/:userToken/:path", async (c) => {
  const userToken = c.req.param("userToken") ?? "";
  const path = c.req.param("path") ?? "";

  const verified = await verifyInboundToken(userToken);
  if (!verified) {
    return c.json({ error: "invalid token" }, 401);
  }
  const userId = verified.userId;

  try {
    const pod = await resolvePodConfig(userId);
    await wakeUserPod(userId, pod);
    await waitForPodReady(userId, INBOUND_WAKE_WAIT_MS);
  } catch (err) {
    console.error(`[inbound] wake failed for ${userId}:`, err);
    // Still attempt the forward below — a warm pod wake failure shouldn't
    // drop an inbound event the pod might already be able to serve.
  }

  const body = await c.req.arrayBuffer();
  const headers = forwardHeaders(c.req.raw.headers);

  const podBase = await getPodInternalBaseUrl(userId);
  if (!podBase) {
    console.warn(`[inbound] no pod base URL for ${userId}, dropping event for ${path}`);
  } else {
    // Fire-and-forget — do NOT await. The pod handles this asynchronously and
    // the external provider only cares that we accepted delivery.
    void fetch(`${podBase}/api/inbound/${path}`, {
      method: "POST",
      headers,
      body,
    }).catch((err) => {
      console.warn(`[inbound] forward to pod failed for ${userId}/${path}:`, err);
    });
  }

  return c.json({ ok: true, accepted: true }, 202);
});

export default inbound;
