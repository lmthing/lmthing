import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Env } from "../types.js";
import {
  getClusterCache,
  getFleetCache,
  getEventsCache,
  isInitialized,
  addSubscriber,
  removeSubscriber,
  getSubscriberCount,
} from "../lib/cluster-status.js";
import {
  statusRateLimit,
  checkSseLimits,
  trackSseOpen,
  trackSseClose,
} from "../middleware/rate-limit.js";

const NOT_READY = JSON.stringify({ error: "Service Unavailable — data not yet available" });

const status = new Hono<Env>();

// Apply rate limit to all status routes
status.use("/*", statusRateLimit());

status.get("/cluster", (c) => {
  const data = getClusterCache();
  if (!data) {
    c.header("Retry-After", "10");
    return c.body(NOT_READY, 503, { "Content-Type": "application/json" });
  }
  c.header("Cache-Control", "no-store");
  return c.body(data, 200, { "Content-Type": "application/json" });
});

status.get("/compute-fleet", (c) => {
  const data = getFleetCache();
  if (!data) {
    c.header("Retry-After", "10");
    return c.body(NOT_READY, 503, { "Content-Type": "application/json" });
  }
  c.header("Cache-Control", "no-store");
  return c.body(data, 200, { "Content-Type": "application/json" });
});

status.get("/events", (c) => {
  const data = getEventsCache();
  if (!data) {
    c.header("Retry-After", "10");
    return c.body(NOT_READY, 503, { "Content-Type": "application/json" });
  }
  c.header("Cache-Control", "no-store");
  return c.body(data, 200, { "Content-Type": "application/json" });
});

status.get("/stream", async (c) => {
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const { allowed, reason } = checkSseLimits(ip);
  if (!allowed) {
    c.header("Retry-After", "30");
    return c.json({ error: `SSE connection limit reached: ${reason}` }, 503);
  }

  trackSseOpen(ip);

  return streamSSE(c, async (stream) => {
    const MAX_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes max
    const IDLE_TIMEOUT_MS = 60 * 1000;       // 60s idle ping
    let lastActivity = Date.now();
    let done = false;

    const cleanup = () => {
      if (!done) {
        done = true;
        trackSseClose(ip);
        removeSubscriber(push);
      }
    };

    const push = (data: string) => {
      if (done) return;
      lastActivity = Date.now();
      stream.writeSSE({ data, event: "update" }).catch(cleanup);
    };

    addSubscriber(push);

    // Send initial snapshot immediately
    const clusterRaw = getClusterCache();
    const fleetRaw = getFleetCache();
    const eventsRaw = getEventsCache();
    const initial = JSON.stringify({
      cluster: clusterRaw ? JSON.parse(clusterRaw) : null,
      fleet: fleetRaw ? JSON.parse(fleetRaw) : null,
      events: eventsRaw ? JSON.parse(eventsRaw) : null,
    });
    await stream.writeSSE({ data: initial, event: "update" });

    const startedAt = Date.now();

    // Idle ping + lifetime enforcement
    const pingInterval = setInterval(async () => {
      if (done) { clearInterval(pingInterval); return; }
      const now = Date.now();
      if (now - lastActivity > IDLE_TIMEOUT_MS) {
        await stream.writeSSE({ data: ":ping", event: "ping" }).catch(() => {});
        lastActivity = now;
      }
      if (now - startedAt > MAX_LIFETIME_MS) {
        cleanup();
        clearInterval(pingInterval);
      }
    }, 15_000);

    // Clean up on client disconnect
    c.req.raw.signal.addEventListener("abort", () => {
      cleanup();
      clearInterval(pingInterval);
    });

    // Keep stream open until done
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (done || c.req.raw.signal.aborted) {
          clearInterval(check);
          cleanup();
          resolve();
        }
      }, 1000);
    });
  });
});

// suppress unused import warning — isInitialized and getSubscriberCount are available for
// future health/debug endpoints
export { isInitialized, getSubscriberCount };

export default status;
