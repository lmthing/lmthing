import { Hono } from "hono";
import crypto from "node:crypto";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import * as zitadel from "../lib/zitadel.js";
import * as db from "../lib/db.js";
import { TIERS } from "../lib/tiers.js";
import { authMiddleware } from "../middleware/auth.js";
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
    const tokens = await zitadel.loginWithPassword(email, password);
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

// GET /oauth/url — get OAuth redirect URL for a provider
auth.get("/oauth/url", async (c) => {
  const provider = c.req.query("provider");
  if (!provider || !["github", "google"].includes(provider)) {
    return c.json({ error: "provider must be 'github' or 'google'" }, 400);
  }

  const redirectTo = c.req.query("redirect_to");
  if (!redirectTo) {
    return c.json({ error: "redirect_to is required" }, 400);
  }

  const url = zitadel.getOAuthUrl(provider as "github" | "google", redirectTo);
  return c.json({ url });
});

// GET /oauth/callback — exchange OAuth authorization code for tokens
// Registered in Zitadel as the redirect URI for the gateway web application
auth.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  try {
    const tokens = await zitadel.exchangeOAuthCode(code);
    await provisionUser(tokens.user.id, tokens.user.email).catch(() => null);

    // Redirect to original app with tokens in URL fragment (same shape as before)
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
      max_budget: info.user_info?.max_budget,
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
    const tokens = await zitadel.refreshTokens(refresh_token);
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
  } catch {
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
    tokens = await zitadel.exchangeTokenForUser(ssoCode.user_id);
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

export default auth;
