const ZITADEL_URL = process.env.ZITADEL_URL!; // https://auth.lmthing.cloud
const SERVICE_PAT = process.env.ZITADEL_SERVICE_PAT!; // machine user Personal Access Token
const CLIENT_ID = process.env.ZITADEL_CLIENT_ID!;
const CLIENT_SECRET = process.env.ZITADEL_CLIENT_SECRET!;

let cachedGithubIdpId: string | null = process.env.ZITADEL_GITHUB_IDP_ID ?? null;

// PAT is a long-lived token — return it directly, no exchange needed.
function getServiceToken(): string {
  return SERVICE_PAT;
}

async function getGithubIdpId(): Promise<string> {
  if (cachedGithubIdpId) return cachedGithubIdpId;

  const res = await fetch(`${ZITADEL_URL}/management/v1/idps/_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getServiceToken()}` },
    body: JSON.stringify({ limit: 100 }),
  });

  if (!res.ok) throw new Error(`Failed to list IDPs: ${await res.text()}`);

  const data = (await res.json()) as {
    result?: Array<{ id: string; name: string; type?: string }>;
  };

  const github = data.result?.find(
    (idp) => idp.type === "IDP_TYPE_GITHUB" || idp.name.toLowerCase().includes("github"),
  );
  if (!github) throw new Error("GitHub IDP not found in Zitadel — check Organization → Identity Providers");

  cachedGithubIdpId = github.id;
  return github.id;
}

export async function createUser(
  email: string,
  password: string,
): Promise<{ userId: string }> {
  const token = getServiceToken();
  const res = await fetch(`${ZITADEL_URL}/v2/users/human`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: email,
      profile: { givenName: "User", familyName: "." },
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
  const token = getServiceToken();
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
  const [token, idpId] = await Promise.all([Promise.resolve(getServiceToken()), getGithubIdpId()]);
  const res = await fetch(`${ZITADEL_URL}/v2/idp_intents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      idpId,
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
  const serviceToken = getServiceToken();

  const retrieveRes = await fetch(
    `${ZITADEL_URL}/v2/idp_intents/${encodeURIComponent(id)}`,
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

  const intentRaw = await retrieveRes.json();
  console.log("IDP intent response:", JSON.stringify(intentRaw));

  const intent = intentRaw as {
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
  const login = idpInfo.userName;
  const email = rawUser.email || `${login}@github.users`;
  const fullName = rawUser.name ?? login ?? "";
  const spaceIdx = fullName.indexOf(" ");
  const givenName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName || login;
  const familyName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : ".";

  const createBody = {
    username: login,
    profile: { givenName, familyName },
    email: { email, isVerified: true },
    idpLinks: [{ idpId: idpInfo.idpId, userId: idpInfo.userId, userName: idpInfo.userName }],
  };
  console.log("Creating user:", JSON.stringify(createBody));

  const createRes = await fetch(`${ZITADEL_URL}/v2/users/human`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify(createBody),
  });

  if (createRes.ok) {
    const created = (await createRes.json()) as { userId: string };
    return { userId: created.userId, email };
  }

  const createErr = await createRes.text();
  console.error("User creation failed:", createRes.status, createErr);

  // Email already exists — find the user and link the IDP
  const searchRes = await fetch(`${ZITADEL_URL}/v2/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      queries: [{ emailQuery: { email, method: "TEXT_QUERY_METHOD_EQUALS" } }],
    }),
  });

  if (!searchRes.ok) throw new Error(`Failed to search for user: ${await searchRes.text()}`);
  const search = (await searchRes.json()) as { result?: Array<{ userId: string }> };
  console.log("User search result:", JSON.stringify(search));
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
  const serviceToken = getServiceToken();
  // PAT authenticates the actor via Bearer header; subject_token is the same PAT.
  const res = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token: serviceToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_subject: userId,
      scope: "openid email profile offline_access urn:zitadel:iam:org:project:id:zitadel:aud",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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
