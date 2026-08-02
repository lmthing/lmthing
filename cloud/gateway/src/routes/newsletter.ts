import { Hono } from "hono";
import { ipRateLimit } from "../middleware/rate-limit.js";
import { sendEmail } from "../lib/email.js";
import { maskEmail, normalizeEmail } from "../lib/email-login.js";
import type { Env } from "../types.js";

const newsletter = new Hono<Env>();

/**
 * `POST /api/newsletter/subscribe` — public, single opt-in.
 *
 * Captures an email for launch updates: creates it as a Resend contact (in a
 * segment/audience when `RESEND_AUDIENCE_ID` is set) and sends one welcome
 * email. No auth — this is the surface for someone who doesn't yet have an
 * invite code (see com's `AlphaSplash`). Duplicate subscribes are idempotent: a
 * contact that already exists returns success without re-sending the welcome.
 *
 * CORS is the gateway-wide `openCors` wildcard (`origin: "*"`) — this route sets
 * no cookie and carries no credential, so the wildcard is safe (see index.ts).
 */
newsletter.post(
  "/subscribe",
  ipRateLimit("newsletter", 10, 15 * 60_000),
  async (c) => {
    const body = await c.req
      .json<{ email?: unknown }>()
      .catch(() => ({}) as { email?: unknown });

    const email = normalizeEmail(body.email);
    if (!email) return c.json({ error: "A valid email address is required" }, 400);

    let created = false;
    try {
      created = await addToResend(email);
    } catch (err) {
      console.error("newsletter subscribe (resend) failed:", err);
      return c.json({ error: "Could not subscribe right now — please try again shortly" }, 502);
    }

    if (created) {
      // Best-effort welcome mail. The `console` transport never throws, so a dev
      // box with no mail config still completes; a real delivery failure is only
      // logged — the contact is already stored, so we don't fail the request.
      try {
        await sendEmail(welcomeEmail(email));
      } catch (err) {
        console.error("newsletter welcome mail failed:", err);
      }
    }

    return c.json({ ok: true, email: maskEmail(email) });
  },
);

/**
 * Create the contact in Resend via the current Contacts API. Resend renamed
 * "Audiences" to "Segments", so `RESEND_AUDIENCE_ID` is a segment id and is sent
 * as `segments: [{ id }]`. Returns `true` when a NEW contact was created, `false`
 * when it already existed (409/422) or when Resend isn't configured (dev). Any
 * other failure bubbles up so the caller can surface it as 502.
 */
async function addToResend(email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false; // dev: no list configured — still counts as subscribed

  const segmentId = process.env.RESEND_AUDIENCE_ID?.trim();
  const res = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
    }),
  });

  if (res.ok) return true; // new contact
  if (res.status === 409 || res.status === 422) return false; // already a contact

  const detail = await res.text().catch(() => "");
  throw new Error(`Resend rejected the contact (${res.status}): ${detail.slice(0, 300)}`);
}

function welcomeEmail(to: string) {
  const subject = "Welcome to lmthing";
  const text = [
    "Thanks for subscribing to lmthing updates.",
    "",
    "We're in private alpha. You'll hear from us when invitations open up and",
    "again at full launch — no spam, just the milestones.",
    "",
    "— The lmthing team",
  ].join("\n");
  const html = [
    "<p>Thanks for subscribing to lmthing updates.</p>",
    "<p>We're in private alpha. You'll hear from us when invitations open up and again",
    "at full launch — no spam, just the milestones.</p>",
    "<p>— The lmthing team</p>",
  ].join("\n");
  return { to, subject, text, html };
}

export default newsletter;
