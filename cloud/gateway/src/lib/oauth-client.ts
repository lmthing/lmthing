import { createHash, randomBytes } from "node:crypto";
import {
  clientId,
  clientSecret,
  type ProviderConfig,
} from "./connections-registry.js";

/**
 * Generic OAuth2 authorization_code + PKCE client.
 *
 * The gateway is the sole custodian of a user's long-lived REFRESH token: it
 * builds the authorize URL, exchanges the code, and refreshes when expired. It
 * mints short-lived ACCESS tokens for the pod on demand (POST /:provider/token);
 * the pod holds the access token briefly and makes the provider REST call
 * itself. The refresh token never leaves the gateway.
 */

// ─── PKCE ─────────────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A high-entropy PKCE code_verifier (RFC 7636). */
export function generatePkceVerifier(): string {
  return base64url(randomBytes(32));
}

/** The S256 code_challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

/** A random state nonce (used alongside the signed-state JWT). */
export function randomState(): string {
  return base64url(randomBytes(16));
}

// ─── Token shape ───────────────────────────────────────────────────────────────

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch-ms when the access token expires, or undefined if it doesn't. */
  expiresAt?: number;
  /** Space/comma-delimited granted scopes as returned by the provider. */
  scopes?: string;
}

// ─── Authorize URL ───────────────────────────────────────────────────────────

/**
 * Build the provider authorize URL the browser is redirected to. `state` is the
 * signed-state JWT (carries userId + provider + PKCE verifier + return URL);
 * `pkceChallenge` is the S256 challenge; `redirectUri` is our public callback.
 */
export function buildAuthorizeUrl(
  provider: ProviderConfig,
  state: string,
  challenge: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId(provider),
    redirect_uri: redirectUri,
    scope: provider.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(provider.extraAuthParams ?? {}),
  });
  return `${provider.authorizeUrl}?${params.toString()}`;
}

// ─── Token endpoint parsing ─────────────────────────────────────────────────

/** Raw token-endpoint JSON we may see across providers. */
interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  // Slack oauth.v2.access shape:
  ok?: boolean;
  error?: string;
  authed_user?: { access_token?: string; scope?: string; refresh_token?: string };
}

/** Parse a provider token response into our normalized TokenSet. */
function parseTokenResponse(
  provider: ProviderConfig,
  raw: RawTokenResponse,
): TokenSet {
  if (provider.id === "slack") {
    // Slack returns 200 with { ok:false, error } on failure. The bot token is
    // top-level `access_token`; a user token (if user scopes requested) lives
    // under authed_user.access_token. Prefer the bot token, fall back to user.
    if (raw.ok === false) {
      throw new Error(`Slack token error: ${raw.error ?? "unknown"}`);
    }
    const accessToken = raw.access_token ?? raw.authed_user?.access_token;
    if (!accessToken) throw new Error("Slack token response missing access_token");
    const scopes = raw.scope ?? raw.authed_user?.scope;
    return {
      accessToken,
      // Only present when token rotation is enabled on the Slack app.
      refreshToken: raw.refresh_token ?? raw.authed_user?.refresh_token,
      expiresAt:
        typeof raw.expires_in === "number"
          ? Date.now() + raw.expires_in * 1000
          : undefined,
      scopes,
    };
  }

  if (!raw.access_token) {
    throw new Error(
      `${provider.id} token response missing access_token${raw.error ? ` (${raw.error})` : ""}`,
    );
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt:
      typeof raw.expires_in === "number"
        ? Date.now() + raw.expires_in * 1000
        : undefined,
    scopes: raw.scope,
  };
}

/** POST a form to the provider token endpoint and parse the response. */
async function postTokenEndpoint(
  provider: ProviderConfig,
  form: Record<string, string>,
): Promise<TokenSet> {
  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "lmthing-gateway",
    },
    body: new URLSearchParams(form).toString(),
  });

  // GitHub returns form-encoded by default unless Accept: application/json (set
  // above). All three providers honour JSON, but be defensive on parse.
  const text = await res.text();
  let raw: RawTokenResponse;
  try {
    raw = JSON.parse(text) as RawTokenResponse;
  } catch {
    throw new Error(
      `${provider.id} token endpoint returned non-JSON (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `${provider.id} token exchange failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return parseTokenResponse(provider, raw);
}

/** Exchange an authorization code for tokens (PKCE verifier included). */
export async function exchangeCode(
  provider: ProviderConfig,
  code: string,
  pkceVerifier: string,
  redirectUri: string,
): Promise<TokenSet> {
  return postTokenEndpoint(provider, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId(provider),
    client_secret: clientSecret(provider),
    code_verifier: pkceVerifier,
  });
}

/**
 * Refresh an access token. Providers may ROTATE the refresh token (Google and
 * Slack can), so the returned TokenSet's `refreshToken` must be persisted by the
 * caller; if the provider omits it, the caller keeps the previous one.
 */
export async function refreshToken(
  provider: ProviderConfig,
  currentRefreshToken: string,
): Promise<TokenSet> {
  return postTokenEndpoint(provider, {
    grant_type: "refresh_token",
    refresh_token: currentRefreshToken,
    client_id: clientId(provider),
    client_secret: clientSecret(provider),
  });
}
