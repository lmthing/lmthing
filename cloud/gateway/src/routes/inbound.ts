import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
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

/** The full public URL an external provider posts to for one binding. Forwarded
 *  to the pod as `x-lmthing-inbound-url` so a provider whose signature is
 *  computed over the request URL (Twilio) can reconstruct the signing base
 *  pod-side — the pod never sees the original gateway URL otherwise. */
function inboundUrl(userToken: string, path: string): string {
  return `${baseUrl()}/api/inbound/${userToken}/${path}`;
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

// ── inbound rate limiting (per user, in-memory) ───────────────────────────
// A leaked long-lived inbound token could be used to spam the public broker and
// wake the user's pod over and over (cost / resource DoS). A per-user token bucket
// caps that BEFORE we wake the pod. Deliberately generous so real provider webhook
// bursts pass untouched; env-tunable. In-memory per gateway replica (an adequate
// per-instance cap) and keyed by the VERIFIED userId, so one user can't throttle
// another. Fail-open: any internal error allows the request.
const RATE_CAPACITY = Number(process.env.INBOUND_RATE_CAPACITY) || 120;
const RATE_REFILL_PER_SEC = Number(process.env.INBOUND_RATE_REFILL_PER_SEC) || 2;
const RATE_IDLE_EVICT_MS = 60 * 60_000;

interface RateBucket {
  tokens: number;
  last: number;
}
const rateBuckets = new Map<string, RateBucket>();
let lastRateEvict = 0;

function allowInbound(userId: string): boolean {
  try {
    const now = Date.now();
    if (now - lastRateEvict > RATE_IDLE_EVICT_MS) {
      lastRateEvict = now;
      for (const [k, b] of rateBuckets) if (now - b.last > RATE_IDLE_EVICT_MS) rateBuckets.delete(k);
    }
    let b = rateBuckets.get(userId);
    if (!b) {
      b = { tokens: RATE_CAPACITY, last: now };
      rateBuckets.set(userId, b);
    }
    b.tokens = Math.min(RATE_CAPACITY, b.tokens + ((now - b.last) / 1000) * RATE_REFILL_PER_SEC);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  } catch {
    return true; // never let the limiter itself drop a legitimate event
  }
}

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

  if (!allowInbound(userId)) {
    return c.json({ error: "rate limited" }, 429);
  }

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
  headers.set("x-lmthing-inbound-url", inboundUrl(userToken, path));

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

// GET /:userToken/:path — a provider's SUBSCRIPTION-VERIFICATION handshake
// (WhatsApp/Meta `?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`). Unlike
// the POST broker, this must be answered SYNCHRONOUSLY with the pod's response
// (the provider expects the challenge echoed back), so we await the forward and
// relay the pod's status/body verbatim. The pod matches `hub.verify_token`
// against the space's configured verify-token env and echoes `hub.challenge`.
inbound.get("/:userToken/:path", async (c) => {
  const userToken = c.req.param("userToken") ?? "";
  const path = c.req.param("path") ?? "";

  const verified = await verifyInboundToken(userToken);
  if (!verified) {
    return c.json({ error: "invalid token" }, 401);
  }
  const userId = verified.userId;

  if (!allowInbound(userId)) {
    return c.json({ error: "rate limited" }, 429);
  }

  try {
    const pod = await resolvePodConfig(userId);
    await wakeUserPod(userId, pod);
    await waitForPodReady(userId, INBOUND_WAKE_WAIT_MS);
  } catch (err) {
    console.error(`[inbound] wake failed for ${userId}:`, err);
  }

  const podBase = await getPodInternalBaseUrl(userId);
  if (!podBase) {
    return c.json({ error: "pod unavailable" }, 503);
  }

  const search = new URL(c.req.url).search; // preserve hub.* query params
  try {
    const r = await fetch(`${podBase}/api/inbound/${path}${search}`, {
      method: "GET",
      headers: { "x-lmthing-inbound-url": inboundUrl(userToken, path) },
    });
    const text = await r.text();
    return c.body(text, r.status as ContentfulStatusCode, {
      "content-type": r.headers.get("content-type") ?? "text/plain",
    });
  } catch (err) {
    console.warn(`[inbound] challenge forward failed for ${userId}/${path}:`, err);
    return c.json({ error: "forward failed" }, 502);
  }
});

export default inbound;
