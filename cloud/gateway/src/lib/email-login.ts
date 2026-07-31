// Passwordless email sign-in — the pure parts.
//
// One request produces TWO credentials for the same database row: a 6-digit code
// the user can type back into the page they started from, and an opaque link
// token they can click from their inbox. Either one proves control of the
// mailbox, and consuming either invalidates both (the row is single-use).
//
// Everything here is deliberately side-effect free — no db, no mailer, no env
// beyond the redirect allowlist — so the policy (what a valid email is, how long
// a code lives, how many guesses it survives, where a magic link may land) is
// testable without a Postgres or a relay. The handlers in routes/auth.ts compose
// these with db.ts and email.ts.

import crypto from "node:crypto";

/** How long a code/link is valid. Long enough to survive a slow mail relay. */
export const CODE_TTL_MS = 15 * 60_000;

/** Wrong-code guesses allowed before the row is burned. */
export const MAX_ATTEMPTS = 5;

/** Sends allowed per mailbox inside {@link SEND_WINDOW_MS}. */
export const MAX_SENDS_PER_WINDOW = 5;
export const SEND_WINDOW_MS = 15 * 60_000;

// ─── Email addresses ─────────────────────────────────────────────────────────

// Intentionally permissive: the requirement is "allow any email", and the real
// verification is that a code sent to the address comes back. This only rejects
// what cannot be an address at all — no @, no dot in the domain, whitespace,
// control characters, or absurd length (RFC 5321 caps a path at 254).
const EMAIL_RE = /^[^\s@,;:<>"'\\]+@[^\s@,;:<>"'\\.]+(\.[^\s@,;:<>"'\\.]+)+$/;

/**
 * Canonical form of a submitted address, or `null` when it cannot be one.
 *
 * Lower-casing is what makes `Ada@Example.com` and `ada@example.com` the same
 * account: the address is the account key on this path, and the code lookup is
 * keyed by it, so a differently-cased retry has to find the row it just created.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

/** `a••••@example.com` — safe to log or echo back in a response. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 1) return `${local}•••${domain}`;
  return `${local[0]}${"•".repeat(Math.min(local.length - 1, 4))}${domain}`;
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

/**
 * A 6-digit code, uniformly distributed.
 *
 * `randomInt` is rejection-sampled by Node, so unlike `randomBytes % 1e6` every
 * code is equally likely — the bias that modulo introduces is small but it is
 * exactly the kind of thing that makes a 6-digit space smaller than it looks.
 */
export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** 256 bits of URL-safe entropy for the magic link. */
export function generateLinkToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * What goes in the database. Only the hash is stored, so a database dump does
 * not hand out live sign-in credentials.
 *
 * The email is mixed in, which is what stops a code issued for one mailbox from
 * being replayed against another's row (the OTP space is only 10^6 — without
 * binding, a code harvested anywhere would be worth trying everywhere).
 */
export function hashCode(email: string, code: string): string {
  return crypto.createHash("sha256").update(`${email}\u0000${code}`).digest("hex");
}

/** Link tokens carry their own 256 bits, so they are hashed unbound. */
export function hashLinkToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── The store-review demo account ───────────────────────────────────────────

/**
 * Whether `email` and `code` are the credentials handed to an app-store reviewer.
 *
 * Google Play requires working credentials for anything behind a login, and every
 * screen past launch here is. The only sign-in mails a one-time code, which a
 * reviewer cannot read because the mailbox is not theirs — and there is no
 * password to put in the App access form at all. Without this the reviewer sees
 * the sign-in screen and nothing else, and the submission is rejected as
 * inaccessible.
 *
 * This IS an auth bypass, so it is written to be the smallest one that does the
 * job. It is inert unless BOTH variables are set, so no deployment gets it by
 * default and unsetting either one revokes it. It is scoped to a single address.
 * And it compares `hashCode(email, code)` rather than the two fields separately:
 * one constant-time comparison over a fixed-length digest covers the address and
 * the code together, so a mismatch cannot reveal which half was wrong, and the
 * address is not leaked by a timing difference.
 *
 * Two things it does NOT do, and must not be made to do. It does not skip the
 * `email-verify` IP rate limit — that is middleware and has already run by the
 * time this is called, and it is the only thing standing between six digits and
 * a guess. And it does not create a privileged account: the session it opens is
 * an ordinary user's, so the workspace behind it should hold demo content and
 * nothing else. Unset `REVIEW_DEMO_CODE` once the review is through.
 */
export function isReviewDemoLogin(email: string, code: string): boolean {
  const demoEmail = normalizeEmail(process.env.REVIEW_DEMO_EMAIL);
  const demoCode = normalizeOtp(process.env.REVIEW_DEMO_CODE);
  if (!demoEmail || !demoCode) return false;
  return hashesEqual(hashCode(email, code), hashCode(demoEmail, demoCode));
}

// ─── Which device asked? ─────────────────────────────────────────────────────

/**
 * Cookie naming the browser that started this sign-in.
 *
 * A magic link is a bearer credential sitting in an inbox, and an inbox is read
 * on whatever device is to hand — often not the one waiting on the sign-in page.
 * Redirecting a session to whoever opens the link is therefore both a UX failure
 * (the browser that asked is still sitting there logged out) and a security one:
 * a forwarded link hands over an account.
 *
 * So the row records a hash of this cookie's value at issue time, and the
 * callback only completes the login when the click carries it back. A click
 * without it is answered with instructions rather than a session — the code is
 * already in that same email, so nothing has to be regenerated or displayed.
 *
 * `__Host-` is deliberate: it is refused by the browser unless the cookie is
 * Secure, path `/`, and carries no Domain, which pins it to exactly this origin
 * and stops a sibling subdomain from setting one that would be sent here.
 */
export const ORIGIN_COOKIE = "__Host-lmthing_email_origin";

/** 256 bits naming this browser. Never leaves the device that asked. */
export function generateOriginToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Carries its own entropy, so — like the link token — it is hashed unbound. */
export function hashOriginToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * `Set-Cookie` for {@link ORIGIN_COOKIE}.
 *
 * `SameSite=None` is required rather than lax: the SPA lives on `lmthing.com`
 * and the gateway on `lmthing.cloud`, so the request that sets this is
 * cross-site and a `Lax` cookie would simply not be stored. That is also why the
 * email routes carry their own credentialed CORS — `Access-Control-Allow-Origin:
 * *` cannot be combined with credentials, so the wildcard policy the rest of
 * `/api/*` uses would silently drop it.
 *
 * It outlives the code by design: expiring together would make a click that
 * arrives a second late look like a different device.
 */
export function originCookie(token: string, maxAgeMs = CODE_TTL_MS * 2): string {
  return [
    `${ORIGIN_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ].join("; ");
}

/** Read {@link ORIGIN_COOKIE} out of a request's Cookie header. */
export function readOriginCookie(header: string | undefined | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== ORIGIN_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

/** Constant-time comparison of two hex digests of the same length. */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** Digits only, so " 123 456" and "123456" both verify. */
export function normalizeOtp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

// ─── Where a magic link may land ─────────────────────────────────────────────

const LMTHING_HOST_RE = /^([a-z0-9-]+\.)*lmthing\.[a-z]{2,}$/;

/**
 * Whether the callback may redirect to `uri`.
 *
 * The magic-link callback puts a live token pair in the URL fragment, so an
 * unchecked `redirect_uri` is a one-click account takeover: anyone who can get a
 * user to request a link for their own address could aim the tokens at their own
 * host. `EMAIL_LOGIN_ALLOWED_ORIGINS` (comma-separated exact origins) replaces
 * the defaults entirely when set; otherwise https on any `lmthing.*` host (or a
 * subdomain of one) and the local dev hosts are allowed.
 */
export function isAllowedRedirect(uri: string, allowedOrigins?: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  const explicit = (allowedOrigins ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit.includes(url.origin);

  const host = url.hostname.toLowerCase();
  if (url.protocol === "https:" && LMTHING_HOST_RE.test(host)) return true;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.endsWith(".test")
  );
}

/**
 * Append the token trio to `redirectTo` as a URL fragment, preserving whatever
 * query it already carries.
 *
 * The fragment is the same shape the GitHub OAuth callback produces, which is
 * why `com`'s `/callback` route handles both without knowing which flow it came
 * from. A fragment (not a query) keeps the tokens out of server logs, out of the
 * `Referer` header, and out of the browser's network tab for the next request.
 */
export function redirectWithTokens(
  redirectTo: string,
  tokens: { access_token: string; refresh_token: string; expires_at: number },
): string {
  const url = new URL(redirectTo);
  url.hash = new URLSearchParams({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: String(tokens.expires_at),
  }).toString();
  return url.toString();
}

// ─── The message ─────────────────────────────────────────────────────────────

/**
 * The sign-in email.
 *
 * No colors and no images: the design-system rule bans raw color literals, and
 * an email cannot resolve a CSS custom property anyway, so the template styles
 * type and spacing only and inherits whatever the mail client provides. The code
 * is in the subject line as well as the body, which is what lets someone finish
 * signing in from a notification preview without opening the mail.
 */
export function renderLoginEmail(opts: {
  code: string;
  link: string;
  ttlMinutes: number;
}): { subject: string; text: string; html: string } {
  const { code, link, ttlMinutes } = opts;
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;

  const text = [
    `Your lmthing sign-in code is ${spaced}`,
    "",
    "Enter it on the page you started from, or open this link:",
    link,
    "",
    `The code and the link both expire in ${ttlMinutes} minutes and can each be used once.`,
    "",
    "If you didn't try to sign in, you can ignore this email — nothing has changed.",
  ].join("\n");

  const html = [
    '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;max-width:480px">',
    '<p style="margin:0 0 20px">Here is your sign-in code for <strong>lmthing</strong>:</p>',
    `<p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;letter-spacing:0.14em;font-weight:600">${escapeHtml(spaced)}</p>`,
    `<p style="margin:0 0 24px">Enter it on the page you started from, or <a href="${escapeHtml(link)}">open this link to sign in</a>.</p>`,
    `<p style="margin:0 0 8px;font-size:13px;opacity:0.7">The code and the link both expire in ${ttlMinutes} minutes and can each be used once.</p>`,
    '<p style="margin:0;font-size:13px;opacity:0.7">If you didn&rsquo;t try to sign in, you can ignore this email &mdash; nothing has changed.</p>',
    "</div>",
  ].join("");

  return { subject: `${spaced} is your lmthing sign-in code`, text, html };
}

/**
 * Shared by every outbound template.
 *
 * Exported rather than copied: a second template with its own escaper is how one
 * of them ends up missing a case. Team-invite mail interpolates a team NAME and
 * an inviter's address — both user-controlled — so this is load-bearing there in
 * a way it is not here.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
