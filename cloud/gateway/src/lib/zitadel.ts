const ZITADEL_URL = process.env.ZITADEL_URL!;
const SERVICE_ACCOUNT_ID = process.env.ZITADEL_SERVICE_ACCOUNT_ID!;
const SERVICE_ACCOUNT_KEY = process.env.ZITADEL_SERVICE_ACCOUNT_KEY!;
const CLIENT_ID = process.env.ZITADEL_CLIENT_ID!;
const CLIENT_SECRET = process.env.ZITADEL_CLIENT_SECRET!;

let cachedServiceToken: string | null = null;
let serviceTokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedServiceToken && Date.now() < serviceTokenExpiry - 30_000) {
    return cachedServiceToken;
  }

  const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SERVICE_ACCOUNT_ID,
      client_secret: SERVICE_ACCOUNT_KEY,
      scope: "openid urn:zitadel:iam:org:project:id:zitadel:aud",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get service token: ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedServiceToken = data.access_token;
  serviceTokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedServiceToken;
}

export async function createUser(
  email: string,
  password: string,
): Promise<{ userId: string }> {
  const token = await getServiceToken();
  const res = await fetch(`${ZITADEL_URL}/v2/users/human`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: email,
      profile: { firstName: "User", lastName: "" },
      email: { email, isVerified: true },
      password: { password, changeRequired: false },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Unknown error" }));
    throw new Error((err as { message?: string }).message || "Failed to create user");
  }

  const data = (await res.json()) as { userId: string };
  return { userId: data.userId };
}

export async function getUserById(
  userId: string,
): Promise<{ id: string; email: string }> {
  const token = await getServiceToken();
  const res = await fetch(`${ZITADEL_URL}/v2/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`User not found: ${userId}`);
  }

  const data = (await res.json()) as {
    user: { userId: string; human?: { email?: { email?: string } } };
  };
  return {
    id: data.user.userId,
    email: data.user.human?.email?.email ?? "",
  };
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      username: email,
      password,
      scope: "openid email profile offline_access urn:zitadel:iam:org:project:id:zitadel:aud",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error_description: "Invalid credentials" }));
    throw new Error(
      (err as { error_description?: string }).error_description || "Login failed",
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

export function getOAuthUrl(
  provider: "github" | "google",
  redirectTo: string,
): string {
  // IDP IDs are configured in Zitadel admin console; map provider name to IDP hint
  const providerMap: Record<string, string> = {
    github: "github",
    google: "google",
  };
  const idpHint = providerMap[provider];
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: `${process.env.BASE_URL}/api/auth/oauth/callback`,
    scope: "openid email profile offline_access",
    state: Buffer.from(redirectTo).toString("base64url"),
    ...(idpHint ? { idp_intent_id: idpHint } : {}),
  });
  return `${process.env.ZITADEL_ISSUER}/oauth/v2/authorize?${params}`;
}

export async function exchangeOAuthCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
}> {
  const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.BASE_URL}/api/auth/oauth/callback`,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error_description: "Exchange failed" }));
    throw new Error(
      (err as { error_description?: string }).error_description || "OAuth exchange failed",
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    id_token?: string;
  };

  // Decode sub + email from the access token payload (no verification needed here — middleware already verifies)
  const [, payloadB64] = data.access_token.split(".");
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf-8"),
  ) as { sub: string; email: string };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    user: { id: payload.sub, email: payload.email },
  };
}

export async function refreshTokens(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error_description: "Refresh failed" }));
    throw new Error(
      (err as { error_description?: string }).error_description || "Token refresh failed",
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

// RFC 8693 Token Exchange — generates a Zitadel token for a user via service account impersonation.
// Requires "Token Exchange" feature enabled in Zitadel instance settings.
export async function exchangeTokenForUser(userId: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const serviceToken = await getServiceToken();

  const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token: serviceToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_subject: userId,
      scope: "openid email profile offline_access",
      client_id: SERVICE_ACCOUNT_ID,
      client_secret: SERVICE_ACCOUNT_KEY,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? "",
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}
