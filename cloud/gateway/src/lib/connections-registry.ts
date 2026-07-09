/**
 * Provider registry for user-connectable OAuth integrations.
 *
 * One entry per provider describes a generic OAuth2 authorization_code + PKCE
 * flow: where to send the user to authorize, where to exchange the code for
 * tokens, the API host all proxied requests are pinned to, the scopes we
 * request, and the env vars that carry this provider's client id/secret. Adding
 * a new provider (Notion, Microsoft, Discord, …) is pure config — no new code.
 *
 * A provider whose client id/secret env vars are unset reports
 * `configured: false` (graceful degradation, mirroring `isGithubAppConfigured()`
 * in github-app.ts) — it still appears in the list, it just can't be connected.
 */

export interface ProviderConfig {
  /** Stable id used in URLs (`/api/connections/:provider/...`) and DB rows. */
  id: string;
  /** Human-readable label for the Connections UI. */
  label: string;
  /** OAuth2 authorization endpoint (user is redirected here to consent). */
  authorizeUrl: string;
  /** OAuth2 token endpoint (code→token, refresh→token). */
  tokenUrl: string;
  /** API host all proxied requests are pinned to. The egress proxy joins this
   *  with the client-supplied `path`; absolute URLs in `path` are rejected. */
  apiBase: string;
  /** Space-delimited scopes requested at authorize time. */
  scopes: string;
  /** Env var holding this provider's OAuth client id. */
  clientIdEnv: string;
  /** Env var holding this provider's OAuth client secret. */
  clientSecretEnv: string;
  /** Whether the provider issues refresh tokens we can use to renew access. */
  refreshable: boolean;
  /** Extra query params appended to the authorize URL (e.g. Google offline). */
  extraAuthParams?: Record<string, string>;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    id: "google",
    label: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // Gmail, Calendar and Drive all live under this host.
    apiBase: "https://www.googleapis.com",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
    ].join(" "),
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    refreshable: true,
    // access_type=offline + prompt=consent are required to actually receive a
    // refresh_token back from Google (and to re-receive it on re-consent).
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  slack: {
    id: "slack",
    label: "Slack",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    apiBase: "https://slack.com/api",
    scopes: "chat:write,channels:read,search:read",
    clientIdEnv: "SLACK_OAUTH_CLIENT_ID",
    clientSecretEnv: "SLACK_OAUTH_CLIENT_SECRET",
    // Slack bot tokens don't expire by default (token rotation is opt-in).
    refreshable: false,
  },
  github: {
    id: "github",
    label: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    apiBase: "https://api.github.com",
    scopes: "repo read:user",
    clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
    clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
    // GitHub OAuth (non-App) tokens don't expire by default.
    refreshable: false,
  },
};

/** All registered providers, in listing order. */
export function listProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

/** Look up a provider by id, or `undefined` if unknown. */
export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS[id];
}

/**
 * True when a provider's client id AND secret env vars are both present, i.e.
 * an lmthing OAuth app has been registered for it. Mirrors
 * `isGithubAppConfigured()` — an unconfigured provider degrades gracefully.
 */
export function isProviderConfigured(id: string): boolean {
  const p = PROVIDERS[id];
  if (!p) return false;
  return Boolean(process.env[p.clientIdEnv] && process.env[p.clientSecretEnv]);
}

/** The provider's OAuth client id (empty string if unset). */
export function clientId(p: ProviderConfig): string {
  return process.env[p.clientIdEnv] ?? "";
}

/** The provider's OAuth client secret (empty string if unset). */
export function clientSecret(p: ProviderConfig): string {
  return process.env[p.clientSecretEnv] ?? "";
}
