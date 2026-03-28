import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import { TIERS } from "../lib/tiers.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Env } from "../types.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { flowType: "implicit" } },
);

const auth = new Hono<Env>();

// ── Helper: provision LiteLLM user + Stripe customer + API key ──
async function provisionUser(userId: string, email: string) {
  // Check if already provisioned
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

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    return c.json({ error: authError.message }, 400);
  }

  try {
    const result = await provisionUser(authData.user.id, email);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provisioning failed";
    return c.json({ error: msg, user_id: authData.user.id }, 500);
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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return c.json({ error: error.message }, 401);
  }

  return c.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  });
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as "github" | "google",
    options: { redirectTo },
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ url: data.url });
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

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token,
  });

  if (error || !data.session) {
    return c.json({ error: error?.message || "Failed to refresh" }, 401);
  }

  return c.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user!.id, email: data.user!.email },
  });
});

// ═══════════════════════════════════════════════════════════════
// SSO — cross-domain single sign-on
// ═══════════════════════════════════════════════════════════════

// POST /sso/create — generate a single-use SSO authorization code
// Called by com/ after user is authenticated, before redirecting back to the requesting app
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
  const expiresAt = new Date(Date.now() + 60_000); // 60 seconds TTL

  const { error } = await supabase.from("sso_codes").insert({
    user_id: user.id,
    code,
    redirect_uri,
    app,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return c.json({ error: "Failed to create SSO code" }, 500);
  }

  return c.json({ code, expires_at: expiresAt.toISOString() });
});

// POST /sso/exchange — exchange SSO code for a Supabase session
// Called by the requesting app (no auth required — the code IS the auth)
auth.post("/sso/exchange", async (c) => {
  const { code, redirect_uri } = await c.req.json<{
    code: string;
    redirect_uri: string;
  }>();

  if (!code || !redirect_uri) {
    return c.json({ error: "code and redirect_uri required" }, 400);
  }

  // Look up the code
  const { data: ssoCode, error: lookupError } = await supabase
    .from("sso_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .single();

  if (lookupError || !ssoCode) {
    return c.json({ error: "Invalid or expired SSO code" }, 400);
  }

  // Validate
  if (new Date(ssoCode.expires_at) < new Date()) {
    return c.json({ error: "SSO code expired" }, 400);
  }

  if (ssoCode.redirect_uri !== redirect_uri) {
    return c.json({ error: "redirect_uri mismatch" }, 400);
  }

  // Mark as used
  await supabase
    .from("sso_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", ssoCode.id);

  // Generate a session for the user
  // Use admin API to create a magic link session
  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(ssoCode.user_id);

  if (userError || !userData.user) {
    return c.json({ error: "User not found" }, 400);
  }

  // Generate a new session by creating a magic link and exchanging it
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
    });

  if (linkError || !linkData) {
    return c.json({ error: "Failed to generate session" }, 500);
  }

  // Exchange the token hash for a session
  const { data: sessionData, error: sessionError } =
    await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });

  if (sessionError || !sessionData.session) {
    return c.json({ error: "Failed to create session" }, 500);
  }

  // Provision LiteLLM user if needed
  try {
    await provisionUser(ssoCode.user_id, userData.user.email!);
  } catch {
    // Non-fatal
  }

  return c.json({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_at: sessionData.session.expires_at,
    user: {
      id: sessionData.user!.id,
      email: sessionData.user!.email,
    },
  });
});

export default auth;
