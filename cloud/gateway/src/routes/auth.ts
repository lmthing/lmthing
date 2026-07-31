import { Hono } from "hono";
import crypto from "node:crypto";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import * as zitadel from "../lib/zitadel.js";
import * as db from "../lib/db.js";
import { TIERS } from "../lib/tiers.js";
import { authMiddleware } from "../middleware/auth.js";
import { ipRateLimit } from "../middleware/rate-limit.js";
import { signTokens, verifyRefreshToken } from "../lib/tokens.js";
import { isEmailConfigured, sendEmail } from "../lib/email.js";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  MAX_SENDS_PER_WINDOW,
  SEND_WINDOW_MS,
  generateLinkToken,
  generateOriginToken,
  generateOtp,
  hashCode,
  hashLinkToken,
  hashOriginToken,
  hashesEqual,
  isAllowedRedirect,
  isReviewDemoLogin,
  maskEmail,
  normalizeEmail,
  normalizeOtp,
  originCookie,
  readOriginCookie,
  redirectWithTokens,
  renderLoginEmail,
} from "../lib/email-login.js";
import type { Env } from "../types.js";

const auth = new Hono<Env>();

// ── Helper: provision LiteLLM user + Stripe customer + API key ──
async function provisionUser(userId: string, email: string) {
  try {
    const info = await litellm.getUserInfo(userId);
    if (info.user_info) {
      const keys = await litellm.listKeys(userId);
      return {
        user_id: userId,
        email,
        tier: info.user_info.metadata?.tier || "free",
        api_key: keys[0]?.token || null,
        already_provisioned: true,
      };
    }
  } catch {
    // User doesn't exist in LiteLLM — provision below
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  const freeTier = TIERS.free;
  await litellm.createUser(userId, freeTier, {
    stripe_customer_id: customer.id,
  });

  const keyResult = await litellm.generateKey(
    userId,
    freeTier,
    `key-${userId.slice(0, 8)}-${Date.now()}`,
  );

  return {
    user_id: userId,
    email,
    tier: "free",
    api_key: keyResult.key,
    already_provisioned: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// AUTH — registration, login, OAuth
// ═══════════════════════════════════════════════════════════════

// POST /register — email + password signup
auth.post("/register", async (c) => {
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ error: "email and password required" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "password must be at least 8 characters" }, 400);
  }

  let userId: string;
  try {
    const user = await zitadel.createUser(email, password);
    userId = user.userId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    return c.json({ error: msg }, 400);
  }

  try {
    const result = await provisionUser(userId, email);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provisioning failed";
    return c.json({ error: msg, user_id: userId }, 500);
  }
});

// POST /login — email + password
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ error: "email and password required" }, 400);
  }

  try {
    const zTokens = await zitadel.loginWithPassword(email, password);
    // Verify credentials via Zitadel, then issue our own tokens
    const userInfo = await zitadel.getUserByEmail(email);
    const tokens = await signTokens(userInfo.id, email);
    return c.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Login failed";
    return c.json({ error: msg }, 401);
  }
});

// GET /oauth/url — start GitHub login via Zitadel IDP Intent (bypasses Zitadel UI)
auth.get("/oauth/url", async (c) => {
  const redirectTo = c.req.query("redirect_to");
  if (!redirectTo) {
    return c.json({ error: "redirect_to is required" }, 400);
  }

  try {
    const successUrl = `${process.env.BASE_URL}/api/auth/oauth/callback?state=${Buffer.from(redirectTo).toString("base64url")}`;
    const url = await zitadel.startIdpIntent(successUrl);
    return c.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start login";
    return c.json({ error: msg }, 500);
  }
});

// GET /oauth/callback — Zitadel IDP Intent callback (id + token params)
auth.get("/oauth/callback", async (c) => {
  const error = c.req.query("error");
  if (error) return c.json({ error }, 400);

  const id = c.req.query("id");
  const token = c.req.query("token");
  const state = c.req.query("state");

  if (!id || !token) {
    return c.json({ error: "Missing intent params" }, 400);
  }

  try {
    const { userId, email } = await zitadel.resolveIdpIntent(id, token);
    const tokens = await signTokens(userId, email);
    await provisionUser(userId, email).catch(() => null);

    const redirectTo = state
      ? Buffer.from(state, "base64url").toString("utf-8")
      : "/";

    const fragment = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: String(tokens.expires_at),
    });

    return c.redirect(`${redirectTo}#${fragment}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth callback failed";
    return c.json({ error: msg }, 400);
  }
});

// POST /provision — create LiteLLM user + key for authenticated user
auth.post("/provision", authMiddleware, async (c) => {
  const user = c.get("user");

  try {
    const result = await provisionUser(user.id, user.email);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provisioning failed";
    return c.json({ error: msg }, 500);
  }
});

// GET /me — current user info + tier
auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");

  try {
    const info = await litellm.getUserInfo(user.id);
    return c.json({
      user_id: user.id,
      email: user.email,
      tier: info.user_info?.metadata?.tier || "free",
      budget_limits: info.user_info?.budget_limits,
      spend: info.user_info?.spend,
    });
  } catch {
    return c.json({
      user_id: user.id,
      email: user.email,
      tier: "free",
    });
  }
});

// POST /refresh — exchange refresh token for new access token
auth.post("/refresh", async (c) => {
  const { refresh_token } = await c.req.json<{ refresh_token: string }>();

  if (!refresh_token) {
    return c.json({ error: "refresh_token required" }, 400);
  }

  try {
    const payload = await verifyRefreshToken(refresh_token);
    if (!payload) return c.json({ error: "Invalid refresh token" }, 401);
    const userInfo = await zitadel.getUserById(payload.userId);
    const tokens = await signTokens(payload.userId, userInfo.email);
    return c.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to refresh";
    return c.json({ error: msg }, 401);
  }
});

// ═══════════════════════════════════════════════════════════════
// SSO — cross-domain single sign-on
// ═══════════════════════════════════════════════════════════════

// POST /sso/create — generate a single-use SSO authorization code
auth.post("/sso/create", authMiddleware, async (c) => {
  const user = c.get("user");
  const { redirect_uri, app } = await c.req.json<{
    redirect_uri: string;
    app: string;
  }>();

  if (!redirect_uri || !app) {
    return c.json({ error: "redirect_uri and app required" }, 400);
  }

  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60_000);

  try {
    await db.insertSsoCode(user.id, code, redirect_uri, app, expiresAt);
  } catch (err) {
    console.error("insertSsoCode failed:", err);
    return c.json({ error: "Failed to create SSO code" }, 500);
  }

  return c.json({ code, expires_at: expiresAt.toISOString() });
});

// POST /sso/exchange — exchange SSO code for a Zitadel session
auth.post("/sso/exchange", async (c) => {
  const { code, redirect_uri } = await c.req.json<{
    code: string;
    redirect_uri: string;
  }>();

  if (!code || !redirect_uri) {
    return c.json({ error: "code and redirect_uri required" }, 400);
  }

  const ssoCode = await db.findAndConsumeSsoCode(code, redirect_uri);
  if (!ssoCode) {
    return c.json({ error: "Invalid or expired SSO code" }, 400);
  }

  let userInfo: { id: string; email: string };
  try {
    userInfo = await zitadel.getUserById(ssoCode.user_id);
  } catch {
    return c.json({ error: "User not found" }, 400);
  }

  let tokens: { access_token: string; refresh_token: string; expires_at: number };
  try {
    tokens = await signTokens(ssoCode.user_id, userInfo.email);
  } catch {
    return c.json({ error: "Failed to create session" }, 500);
  }

  await provisionUser(ssoCode.user_id, userInfo.email).catch(() => null);

  return c.json({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    user: { id: userInfo.id, email: userInfo.email },
  });
});

// ═══════════════════════════════════════════════════════════════
// Local dev only — demo token for VITE_DEMO_USER=true frontends
// ═══════════════════════════════════════════════════════════════

// GET /demo-token — returns a signed JWT for a hardcoded local-dev-user.
// Only active when LOCAL_DEV=true. Lets the computer app (demo mode) call
// /api/compute/ensure and open WebSocket sessions without real auth.
auth.get("/demo-token", async (c) => {
  if (process.env.LOCAL_DEV !== "true") {
    return c.json({ error: "Not found" }, 404);
  }
  const { access_token, expires_at } = await signTokens(
    "local-dev-user",
    "dev@local",
  );
  return c.json({ access_token, expires_at });
});

// ═══════════════════════════════════════════════════════════════
// EMAIL — passwordless sign-in (magic link + one-time code)
// ═══════════════════════════════════════════════════════════════
//
// Any address can sign in, and there is no separate registration: proving
// control of the mailbox IS the account. One request issues two credentials for
// one single-use row — a 6-digit code to type back into the page, and an opaque
// link to click from the inbox — so the flow completes whether the mail is read
// on the same device or another one. Details of the policy (TTLs, attempt caps,
// where a link may redirect) are in lib/email-login.ts; the mail transports are
// in lib/email.ts.
//
// This sits alongside GitHub OAuth, it does not replace it: an address that
// already has an account — password-registered, or created by the GitHub IDP
// link — resolves to that same Zitadel user, so both doors open the same account.

// POST /email/start — send a sign-in code + magic link to any email
auth.post(
  "/email/start",
  ipRateLimit("email-login", 10, 15 * 60_000),
  async (c) => {
    const body = await c.req
      .json<{ email?: unknown; redirect_uri?: unknown }>()
      .catch(() => ({}) as { email?: unknown; redirect_uri?: unknown });

    const email = normalizeEmail(body.email);
    if (!email) return c.json({ error: "A valid email address is required" }, 400);

    // Where the magic link lands. Unvalidated, this would hand a token pair to
    // any host an attacker named, so an unknown origin is rejected outright
    // rather than silently replaced with a default.
    const requested = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
    let redirectUri: string | null = null;
    if (requested) {
      if (!isAllowedRedirect(requested, process.env.EMAIL_LOGIN_ALLOWED_ORIGINS)) {
        return c.json({ error: "redirect_uri is not an allowed origin" }, 400);
      }
      redirectUri = requested;
    }

    // A deployment with no mail transport cannot deliver a code, and answering
    // "sent" would be a lie that looks like a working login. EMAIL_DEV_ECHO
    // (dev/CI only) is the explicit opt-in that returns the credentials in the
    // response instead.
    const echo = process.env.EMAIL_DEV_ECHO === "true" || process.env.LOCAL_DEV === "true";
    if (!isEmailConfigured() && !echo) {
      return c.json(
        { error: "Email sign-in is not configured on this deployment" },
        503,
      );
    }

    const since = new Date(Date.now() - SEND_WINDOW_MS);
    try {
      const recent = await db.countRecentEmailLoginCodes(email, since);
      if (recent >= MAX_SENDS_PER_WINDOW) {
        return c.json(
          { error: "Too many sign-in emails for this address — try again shortly" },
          429,
        );
      }
    } catch (err) {
      console.error("email login throttle check failed:", err);
      return c.json({ error: "Sign-in is temporarily unavailable" }, 503);
    }

    const code = generateOtp();
    const linkToken = generateLinkToken();
    // Names THIS browser, so the callback can tell the device that asked from any
    // other device the mail is read on. Reused when the caller already has one, so
    // asking twice from the same page does not orphan the first row's binding.
    const originToken = readOriginCookie(c.req.header("cookie")) ?? generateOriginToken();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    try {
      await db.insertEmailLoginCode({
        email,
        codeHash: hashCode(email, code),
        linkHash: hashLinkToken(linkToken),
        redirectUri,
        originHash: hashOriginToken(originToken),
        expiresAt,
      });
    } catch (err) {
      console.error("insertEmailLoginCode failed:", err);
      return c.json({ error: "Failed to start email sign-in" }, 500);
    }

    const link = `${process.env.BASE_URL}/api/auth/email/callback?token=${encodeURIComponent(linkToken)}`;
    const message = renderLoginEmail({
      code,
      link,
      ttlMinutes: Math.round(CODE_TTL_MS / 60_000),
    });

    try {
      await sendEmail({
        to: email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (err) {
      // Log the real reason, tell the client only that delivery failed — an SMTP
      // error string can carry the relay host and account name.
      console.error("sign-in email delivery failed:", err);
      return c.json({ error: "Could not send the sign-in email" }, 502);
    }

    void db.purgeExpiredEmailLoginCodes().catch(() => null);

    // Only lands if the caller sent credentials AND the response carries the
    // credentialed CORS headers the email routes are mounted with. A caller that
    // does neither (curl, the native app) simply has no cookie, and its links take
    // the "different device" path — which is correct: it has no browser waiting.
    c.header("Set-Cookie", originCookie(originToken));

    return c.json({
      sent: true,
      email: maskEmail(email),
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      // Dev/CI only — lets a test or a local run finish the flow without a relay.
      ...(echo && !isEmailConfigured() ? { dev_code: code, dev_link: link } : {}),
    });
  },
);

// POST /email/verify — exchange the 6-digit code for a gateway session
auth.post(
  "/email/verify",
  ipRateLimit("email-verify", 30, 15 * 60_000),
  async (c) => {
    const body = await c.req
      .json<{ email?: unknown; code?: unknown }>()
      .catch(() => ({}) as { email?: unknown; code?: unknown });

    const email = normalizeEmail(body.email);
    const code = normalizeOtp(body.code);
    if (!email || !code) {
      return c.json({ error: "email and a 6-digit code are required" }, 400);
    }

    // The store-review demo account, when one is configured. It has to come
    // before the lookup rather than after a miss: nothing was ever mailed for it,
    // so there is no row, and a fallback after "that code has expired" would be a
    // second code path reached only by an error. The IP rate limit above has
    // already run — this is deliberately inside it, not around it.
    if (isReviewDemoLogin(email, code)) {
      const session = await mintEmailSession(email);
      if (!session) return c.json({ error: "Could not complete sign-in" }, 500);
      return c.json(sessionBody(session, email));
    }

    const row = await db.findLiveEmailLoginCode(email).catch((err) => {
      console.error("findLiveEmailLoginCode failed:", err);
      return null;
    });
    if (!row) {
      return c.json({ error: "That code has expired — request a new one" }, 401);
    }

    if (!hashesEqual(row.code_hash, hashCode(email, code))) {
      const attempts = await db
        .recordEmailLoginAttempt(row.id, MAX_ATTEMPTS)
        .catch(() => MAX_ATTEMPTS);
      const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
      return c.json(
        {
          error:
            remaining > 0
              ? "That code is not right"
              : "Too many incorrect attempts — request a new code",
          attempts_remaining: remaining,
        },
        401,
      );
    }

    // Spend the row BEFORE minting anything: if two requests submit the same
    // correct code, exactly one gets a session.
    if (!(await db.consumeEmailLoginCode(row.id))) {
      return c.json({ error: "That code has already been used" }, 401);
    }

    const session = await mintEmailSession(email);
    if (!session) return c.json({ error: "Could not complete sign-in" }, 500);
    return c.json(sessionBody(session, email));
  },
);

// GET /email/callback — the magic link; redirects with tokens in the URL fragment
auth.get("/email/callback", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const row = await db.findLiveEmailLoginCodeByLink(hashLinkToken(token)).catch((err) => {
    console.error("findLiveEmailLoginCodeByLink failed:", err);
    return null;
  });
  if (!row) {
    return c.json({ error: "This sign-in link has expired or was already used" }, 401);
  }

  // Is this the browser that asked? A link read on a second device must NOT be
  // spent here: doing so logs in the wrong device and leaves the one waiting on
  // the sign-in page logged out, and it makes a forwarded link an account
  // takeover. The row is left untouched so the code in that same email keeps
  // working on the device that started the flow.
  const presented = readOriginCookie(c.req.header("cookie"));
  // Truthy rather than `!= null`: a row issued before the origin column existed reads
  // back as undefined, and `hashesEqual` would throw on it — turning "we cannot prove
  // this is the same device", which has a perfectly good answer, into a 500.
  const sameDevice =
    typeof row.origin_hash === "string" &&
    row.origin_hash.length > 0 &&
    presented !== null &&
    hashesEqual(row.origin_hash, hashOriginToken(presented));

  if (!sameDevice) {
    return c.html(otherDevicePage(), 200);
  }

  if (!(await db.consumeEmailLoginCode(row.id))) {
    return c.json({ error: "This sign-in link was already used" }, 401);
  }

  const session = await mintEmailSession(row.email);
  if (!session) return c.json({ error: "Could not complete sign-in" }, 500);

  // No redirect_uri was recorded (an API-only caller): there is nowhere to send
  // the browser, so hand the session back directly.
  if (!row.redirect_uri) return c.json(sessionBody(session, row.email));

  return c.redirect(redirectWithTokens(row.redirect_uri, session.tokens));
});

interface EmailSession {
  userId: string;
  tokens: { access_token: string; refresh_token: string; expires_at: number };
}

/**
 * Resolve the identity for a proven mailbox and mint a gateway session; null when
 * the identity store could not be reached.
 *
 * Shared by the code and the link paths, which differ only in how the mailbox was
 * proven. Both create the account on first sign-in, and both provision
 * LiteLLM/Stripe best-effort — exactly as the OAuth path does, because a LiteLLM
 * or Stripe hiccup must not cost the user a session they have already proven they
 * own.
 */
async function mintEmailSession(email: string): Promise<EmailSession | null> {
  let userId: string;
  try {
    const user = await zitadel.findOrCreateUserByEmail(email);
    userId = user.id;
  } catch (err) {
    console.error("findOrCreateUserByEmail failed:", err);
    return null;
  }

  const tokens = await signTokens(userId, email);
  await provisionUser(userId, email).catch(() => null);
  return { userId, tokens };
}

/**
 * What a link opened on a device that did not start the sign-in gets.
 *
 * Deliberately NOT a session, and deliberately not a new code either: the 6-digit
 * code is already in the email this link came from, so the only thing missing is
 * telling the reader where to type it. Nothing is consumed, so the waiting device
 * can still finish.
 *
 * Inlined rather than served from a SPA because it has to render on a phone that
 * has never loaded lmthing, from the gateway origin, with no build step in front
 * of it — and because a redirect to a styled page would put the token in a
 * `Referer`. No user input is interpolated, so there is nothing to escape.
 */
function otherDevicePage(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Finish signing in on the other device</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px; }
  main { max-width: 30rem; text-align: center; }
  h1 { font-size: 1.25rem; margin: 0 0 .75rem; }
  p { margin: 0 0 .75rem; opacity: .8; }
  strong { white-space: nowrap; }
</style>
</head><body><main>
<h1>Almost there — finish on the other device</h1>
<p>This link was opened on a different device or browser than the one that asked to sign in, so we
have not signed anyone in here.</p>
<p>Go back to the device where you started and enter the <strong>6-digit code</strong> from this same
email. It is still valid.</p>
</main></body></html>`;
}

function sessionBody(session: EmailSession, email: string) {
  return {
    access_token: session.tokens.access_token,
    refresh_token: session.tokens.refresh_token,
    expires_at: session.tokens.expires_at,
    user: { id: session.userId, email },
  };
}

export default auth;
