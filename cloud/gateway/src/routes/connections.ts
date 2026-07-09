import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import {
  signConnectState,
  verifyConnectState,
  signConnectionsToken,
  verifyConnectionsToken,
} from "../lib/tokens.js";
import {
  listProviders,
  getProvider,
  isProviderConfigured,
} from "../lib/connections-registry.js";
import {
  buildAuthorizeUrl,
  exchangeCode,
  refreshToken as refreshProviderToken,
  generatePkceVerifier,
  pkceChallenge,
  type TokenSet,
} from "../lib/oauth-client.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import {
  listConnections,
  upsertConnection,
  deleteConnection,
  getConnectionForUpdate,
  type ConnectionUpsert,
} from "../lib/db.js";
import { getEnvVars, setEnvVars } from "../lib/compute.js";
import type { Env } from "../types.js";

const connections = new Hono<Env>();

/** Our public OAuth callback URL (registered with each provider). */
function redirectUri(): string {
  const base = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/api/connections/callback`;
}

/** Encrypt a TokenSet into the DB upsert shape (tokens at rest are encrypted). */
function toUpsert(tokens: TokenSet, fallbackScopes?: string | null): ConnectionUpsert {
  return {
    access_token: encrypt(tokens.accessToken),
    refresh_token: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    expires_at: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
    scopes: tokens.scopes ?? fallbackScopes ?? null,
    status: "connected",
    error: null,
  };
}

// GET / — list registry providers with per-user connection status. Never
// returns tokens.
connections.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  try {
    const rows = await listConnections(user.id);
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    const providers = listProviders().map((p) => {
      const row = byProvider.get(p.id);
      return {
        id: p.id,
        label: p.label,
        configured: isProviderConfigured(p.id),
        connected: Boolean(row) && row?.status === "connected",
        status: row?.status ?? null,
        scopes: row?.scopes ?? p.scopes,
      };
    });
    return c.json({ providers });
  } catch (err) {
    console.error(`Failed to list connections for ${user.id}:`, err);
    return c.json({ error: "Failed to list connections" }, 500);
  }
});

// GET /:provider/connect — build the authorize URL (PKCE + signed state).
connections.get("/:provider/connect", authMiddleware, async (c) => {
  const user = c.get("user");
  const providerId = c.req.param("provider") ?? "";
  const provider = getProvider(providerId);
  if (!provider) return c.json({ error: "Unknown provider" }, 404);
  if (!isProviderConfigured(providerId)) {
    return c.json({ error: `${provider.label} is not configured` }, 503);
  }
  const redirectTo = c.req.query("redirect_to") ?? "";
  const verifier = generatePkceVerifier();
  const challenge = pkceChallenge(verifier);
  const state = await signConnectState(user.id, providerId, verifier, redirectTo);
  return c.json({
    url: buildAuthorizeUrl(provider, state, challenge, redirectUri()),
  });
});

// GET /callback — the provider redirects here after the user consents. Public
// (the provider has no gateway auth); the signed `state` ties it to the user and
// carries the PKCE verifier + return URL.
connections.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthError = c.req.query("error");
  if (oauthError) {
    return c.text(`OAuth error: ${oauthError}`, 400);
  }
  if (!code || !state) {
    return c.text("Missing code or state", 400);
  }
  const verified = await verifyConnectState(state);
  if (!verified) {
    return c.text("Invalid or expired connect state", 400);
  }
  const provider = getProvider(verified.provider);
  if (!provider) {
    return c.text("Unknown provider", 400);
  }

  let tokens: TokenSet;
  try {
    tokens = await exchangeCode(
      provider,
      code,
      verified.pkceVerifier,
      redirectUri(),
    );
  } catch (err) {
    console.error(`Code exchange failed for ${verified.userId}/${provider.id}:`, err);
    return c.text("Failed to exchange authorization code", 502);
  }

  try {
    await upsertConnection(verified.userId, provider.id, toUpsert(tokens));
  } catch (err) {
    console.error(`Failed to store connection for ${verified.userId}/${provider.id}:`, err);
    return c.text("Failed to record connection", 500);
  }

  // Inject a scoped connections JWT into the pod's user-env so the pod can reach
  // the egress proxy. GET+merge+PUT (setEnvVars replaces the whole secret). The
  // JWT is long-lived; only write it if absent so we don't roll the pod on every
  // connect. Best-effort — a missing pod (free tier not yet provisioned) must not
  // fail the connect; the JWT is (re)injected on the next connect once a pod exists.
  try {
    const existing = await getEnvVars(verified.userId);
    if (!existing.LMTHING_CONNECTIONS_JWT) {
      const jwt = await signConnectionsToken(verified.userId);
      await setEnvVars(verified.userId, {
        ...existing,
        LMTHING_CONNECTIONS_JWT: jwt,
      });
    }
  } catch (err) {
    console.warn(
      `Could not inject LMTHING_CONNECTIONS_JWT for ${verified.userId}:`,
      err,
    );
  }

  return c.redirect(verified.redirectTo || "/");
});

// DELETE /:provider — disconnect (best-effort provider revoke omitted for now).
connections.delete("/:provider", authMiddleware, async (c) => {
  const user = c.get("user");
  const providerId = c.req.param("provider") ?? "";
  if (!getProvider(providerId)) {
    return c.json({ error: "Unknown provider" }, 404);
  }
  try {
    await deleteConnection(user.id, providerId);
    return c.json({ ok: true });
  } catch (err) {
    console.error(`Failed to delete connection for ${user.id}/${providerId}:`, err);
    return c.json({ error: "Failed to disconnect" }, 500);
  }
});

// POST /:provider/token — mint a short-lived ACCESS token for the pod. Called BY
// THE POD (not the browser) with the scoped connections JWT. The gateway remains
// the sole custodian of the long-lived REFRESH token (never handed out); it
// returns a fresh access token (refreshing under a per-(user,provider) row lock
// when the current one is expired, or when the pod forces it after a provider
// 401) plus the provider `apiBase`. The pod then makes the REST call directly.
connections.post("/:provider/token", async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization" }, 401);
  }
  const verified = await verifyConnectionsToken(header.slice(7));
  if (!verified) {
    return c.json({ error: "Invalid connections token" }, 401);
  }

  const providerId = c.req.param("provider") ?? "";
  const provider = getProvider(providerId);
  if (!provider) {
    return c.json({ error: "Unknown provider" }, 404);
  }

  // Optional `{ refresh: true }` forces a refresh even when the stored token looks
  // unexpired — the pod sends it after a provider 401 (early revocation).
  let forceRefresh = false;
  try {
    const raw = await c.req.text();
    if (raw) forceRefresh = (JSON.parse(raw) as { refresh?: unknown }).refresh === true;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  try {
    const resolved = await getConnectionForUpdate(
      verified.userId,
      providerId,
      async (row, tx) => {
        if (!row || row.status !== "connected" || !row.access_token) {
          return { error: "not-connected" as const };
        }

        const expired =
          row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now();
        const needRefresh = expired || forceRefresh;

        if (needRefresh && provider.refreshable && row.refresh_token) {
          try {
            const currentRefresh = decrypt(row.refresh_token);
            const refreshed = await refreshProviderToken(provider, currentRefresh);
            // Providers may rotate the refresh token — persist the new one, or
            // keep the previous one when the provider omits it.
            const nextRefresh = refreshed.refreshToken ?? currentRefresh;
            const expiresAt = refreshed.expiresAt ? new Date(refreshed.expiresAt) : null;
            await tx.updateConnection({
              access_token: encrypt(refreshed.accessToken),
              refresh_token: encrypt(nextRefresh),
              expires_at: expiresAt,
              scopes: refreshed.scopes ?? row.scopes,
              status: "connected",
              error: null,
            });
            return { token: refreshed.accessToken, expiresAt: expiresAt ? expiresAt.getTime() : null };
          } catch (err) {
            console.error(`Refresh failed for ${verified.userId}/${providerId}:`, err);
            await tx.updateConnection({
              access_token: row.access_token,
              refresh_token: row.refresh_token,
              expires_at: row.expires_at ? new Date(row.expires_at) : null,
              scopes: row.scopes,
              status: "error",
              error: "token refresh failed",
            });
            return { error: "refresh-failed" as const };
          }
        }

        // Expired with no way to refresh ⇒ the user must reconnect.
        if (expired && (!provider.refreshable || !row.refresh_token)) {
          await tx.updateConnection({
            access_token: row.access_token,
            refresh_token: row.refresh_token,
            expires_at: row.expires_at ? new Date(row.expires_at) : null,
            scopes: row.scopes,
            status: "error",
            error: "access token expired and not refreshable",
          });
          return { error: "expired" as const };
        }

        // Current token is still valid (or a forced refresh on a non-refreshable
        // provider, where returning the current token is the best we can do).
        return {
          token: decrypt(row.access_token),
          expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
        };
      },
    );

    if ("error" in resolved) {
      if (resolved.error === "not-connected") {
        return c.json({ error: `${provider.label} not connected` }, 409);
      }
      if (resolved.error === "expired") {
        return c.json({ error: `${provider.label} token expired — reconnect required` }, 401);
      }
      return c.json(
        { error: `Failed to refresh ${provider.label} token — reconnect required` },
        502,
      );
    }

    // The access token is handed to the pod; the refresh token stays here.
    return c.json({
      accessToken: resolved.token,
      apiBase: provider.apiBase,
      expiresAt: resolved.expiresAt,
    });
  } catch (err) {
    console.error(`Token mint failed for ${verified.userId}/${providerId}:`, err);
    return c.json({ error: "Token mint failed" }, 500);
  }
});

export default connections;
