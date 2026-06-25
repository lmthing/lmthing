import type { Context, Next } from "hono";

interface Bucket {
  tokens: number;
  lastRefill: number;
  lastSeen: number;
}

const RATE = 60;          // tokens per window
const WINDOW_MS = 60_000; // 1 minute
const MAX_MAP_SIZE = 10_000;
const EVICT_AFTER_MS = 5 * 60_000; // evict entries not seen in 5 min

const buckets = new Map<string, Bucket>();

// Evict stale entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) {
    if (now - b.lastSeen > EVICT_AFTER_MS) buckets.delete(ip);
  }
}, 2 * 60_000);

function getIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function statusRateLimit() {
  return async function rateLimitMiddleware(c: Context, next: Next) {
    const ip = getIp(c);
    const now = Date.now();

    let b = buckets.get(ip);
    if (!b) {
      if (buckets.size >= MAX_MAP_SIZE) {
        // Evict oldest entry to bound memory
        const oldest = [...buckets.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
        if (oldest) buckets.delete(oldest[0]);
      }
      b = { tokens: RATE, lastRefill: now, lastSeen: now };
      buckets.set(ip, b);
    }

    // Refill tokens proportional to elapsed time
    const elapsed = now - b.lastRefill;
    const refill = Math.floor((elapsed / WINDOW_MS) * RATE);
    if (refill > 0) {
      b.tokens = Math.min(RATE, b.tokens + refill);
      b.lastRefill = now;
    }
    b.lastSeen = now;

    if (b.tokens <= 0) {
      const retryAfter = Math.ceil((WINDOW_MS - (now - b.lastRefill)) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too Many Requests" }, 429);
    }

    b.tokens--;
    return next();
  };
}

// SSE per-IP connection tracking
const sseByIp = new Map<string, number>();
const SSE_PER_IP_MAX = 3;
const SSE_GLOBAL_MAX = 200;
let sseGlobalCount = 0;

export function checkSseLimits(ip: string): { allowed: boolean; reason?: string } {
  if (sseGlobalCount >= SSE_GLOBAL_MAX) return { allowed: false, reason: "global cap reached" };
  const perIp = sseByIp.get(ip) ?? 0;
  if (perIp >= SSE_PER_IP_MAX) return { allowed: false, reason: "per-IP cap reached" };
  return { allowed: true };
}

export function trackSseOpen(ip: string) {
  sseGlobalCount++;
  sseByIp.set(ip, (sseByIp.get(ip) ?? 0) + 1);
}

export function trackSseClose(ip: string) {
  sseGlobalCount = Math.max(0, sseGlobalCount - 1);
  const cur = sseByIp.get(ip) ?? 1;
  if (cur <= 1) sseByIp.delete(ip);
  else sseByIp.set(ip, cur - 1);
}

export function getSseGlobalCount(): number { return sseGlobalCount; }
