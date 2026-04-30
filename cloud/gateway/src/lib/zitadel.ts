const ZITADEL_URL = process.env.ZITADEL_URL!; // https://auth.lmthing.cloud
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

// Start a Zitadel IDP Intent for GitHub — returns the GitHub OAuth URL directly,
// bypassing Zitadel's login UI entirely.
export async function startIdpIntent(successUrl: string): Promise<string> {
  const token = await getServiceToken();
  const res = await fetch(`${ZITADEL_URL}/v2/idp_intents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      idpId: process.env.ZITADEL_GITHUB_IDP_ID,
      urls: {
        successUrl,
        failureUrl: `${process.env.BASE_URL}/api/auth/oauth/callback?error=idp_failed`,
      },
    }),
  });

  if (!res.ok) throw new Error(`IDP intent failed: ${await res.text()}`);
  const data = (await res.json()) as { authUrl: string };
  return data.authUrl;
}

// After GitHub redirects back via Zitadel, resolve the intent to get/create the user.
export async function resolveIdpIntent(
  id: string,
  token: string,
): Promise<{ userId: string; email: string }> {
  const serviceToken = await getServiceToken();

  const retrieveRes = await fetch(
    `${ZITADEL_URL}/v2/idp_intents/${encodeURIComponent(id)}/retrieve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ idpIntentToken: token }),
    },
  );

  if (!retrieveRes.ok) throw new Error(`Intent retrieve failed: ${await retrieveRes.text()}`);

  const intent = (await retrieveRes.json()) as {
    userId?: string;
    idpInformation?: {
      idpId: string;
      userId: string;
      userName: string;
      rawInformation?: { User?: { email?: string; name?: string; login?: string } };
    };
  };

  // User already exists and is linked to this IDP
  if (intent.userId) {
    const user = await getUserById(intent.userId);
    return { userId: intent.userId, email: user.email };
  }

  // First login — create user and link IDP
  const idpInfo = intent.idpInformation!;
  const rawUser = idpInfo.rawInformation?.User ?? {};
  const email = rawUser.email ?? "";
  const fullName = rawUser.name ?? rawUser.login ?? idpInfo.userName ?? "";
  const spaceIdx = fullName.indexOf(" ");
  const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName || "User";
  const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : ".";

  const createRes = await fetch(`${ZITADEL_URL}/v2/users/human`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      username: email || idpInfo.userName,
      profile: { firstName, lastName },
      email: { email, isVerified: true },
      idpLinks: [{ idpId: idpInfo.idpId, userId: idpInfo.userId, userName: idpInfo.userName }],
    }),
  });

  if (createRes.ok) {
    const created = (await createRes.json()) as { userId: string };
    return { userId: created.userId, email };
  }

  // Email already exists — find the user and link the IDP
  const searchRes = await fetch(`${ZITADEL_URL}/v2/users/_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      queries: [{ emailQuery: { email, method: "TEXT_QUERY_METHOD_EQUALS" } }],
    }),
  });

  if (!searchRes.ok) throw new Error("Failed to create or find user");
  const search = (await searchRes.json()) as { result?: Array<{ userId: string }> };
  const existingId = search.result?.[0]?.userId;
  if (!existingId) throw new Error("User creation conflict but user not found");

  await fetch(`${ZITADEL_URL}/v2/users/${existingId}/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      idpLink: { idpId: idpInfo.idpId, userId: idpInfo.userId, userName: idpInfo.userName },
    }),
  });

  return { userId: existingId, email };
}

export async function refreshTokens(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
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
