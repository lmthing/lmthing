import { SignJWT, jwtVerify } from "jose";

const secret = Buffer.from(process.env.GATEWAY_JWT_SECRET!, "base64");

const ACCESS_TTL = "12h";
const REFRESH_TTL = "30d";

export async function signTokens(
  userId: string,
  email: string,
): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expires_at = now + 12 * 60 * 60;

  const access_token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);

  const refresh_token = await new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(REFRESH_TTL)
    .sign(secret);

  return { access_token, refresh_token, expires_at };
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || payload["type"] !== "refresh") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// --- Backup tokens ---
//
// The compute pod runs backups/restores autonomously (a periodic timer, and a
// SIGTERM flush) with no user request in flight, so it can't relay a user's
// access token. Instead the gateway mints a long-lived, narrowly-scoped
// (`aud: "backup"`) JWT and injects it into the pod's `user-env` secret; the
// pod presents it to POST /api/backup/token to obtain a short-lived GitHub App
// installation token. This keeps GitHub credentials out of the pod entirely.

const BACKUP_TTL = "365d";

export async function signBackupToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("backup")
    .setIssuedAt()
    .setExpirationTime(BACKUP_TTL)
    .sign(secret);
}

export async function verifyBackupToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { audience: "backup" });
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// --- Compute tokens ---
//
// Per-user compute pods make autonomous calls back to the gateway with no user
// request in flight — self-idle scale-to-zero (POST /api/compute/self-idle) and
// cron-schedule publishing (POST /api/compute/cron-manifest) — so they can't
// relay a browser access token. As with backup tokens, the gateway mints a
// long-lived, narrowly-scoped (`aud: "compute"`) JWT and injects it into the
// pod's `user-env` secret. A pod can only ever act on its OWN namespace: the
// userId is taken from the verified token subject, never from the request body.

const COMPUTE_TTL = "365d";

export async function signComputeToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("compute")
    .setIssuedAt()
    .setExpirationTime(COMPUTE_TTL)
    .sign(secret);
}

export async function verifyComputeToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { audience: "compute" });
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// Short-lived signed state carried through the GitHub App install redirect so
// the callback (which GitHub hits without our auth header) can be tied back to
// the user who initiated it.
const INSTALL_STATE_TTL = "10m";

export async function signInstallState(
  userId: string,
  redirectTo: string,
): Promise<string> {
  return new SignJWT({ rt: redirectTo })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("backup-install")
    .setIssuedAt()
    .setExpirationTime(INSTALL_STATE_TTL)
    .sign(secret);
}

export async function verifyInstallState(
  token: string,
): Promise<{ userId: string; redirectTo: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      audience: "backup-install",
    });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      redirectTo: typeof payload.rt === "string" ? payload.rt : "",
    };
  } catch {
    return null;
  }
}

// --- Connections (OAuth integrations) ---
//
// Two token kinds mirror the backup flow for the generic OAuth broker:
//
//  1. Connect-state (`aud: "connections-connect"`, 10m) — short-lived signed
//     state carried through the auth-less provider callback. It ties the
//     callback back to the initiating user AND smuggles the PKCE verifier +
//     provider + return URL through the redirect (the callback has no session).
//  2. Connections token (`aud: "connections"`, long-lived) — injected into the
//     pod's `user-env` secret so the pod can mint short-lived provider access
//     tokens (POST /api/connections/:provider/token). Identical shape to the
//     backup/compute tokens; userId is always taken from the verified subject.

const CONNECT_STATE_TTL = "10m";

export async function signConnectState(
  userId: string,
  provider: string,
  pkceVerifier: string,
  redirectTo: string,
): Promise<string> {
  return new SignJWT({ provider, pv: pkceVerifier, rt: redirectTo })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("connections-connect")
    .setIssuedAt()
    .setExpirationTime(CONNECT_STATE_TTL)
    .sign(secret);
}

export async function verifyConnectState(token: string): Promise<{
  userId: string;
  provider: string;
  pkceVerifier: string;
  redirectTo: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      audience: "connections-connect",
    });
    if (
      !payload.sub ||
      typeof payload.provider !== "string" ||
      typeof payload.pv !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      provider: payload.provider,
      pkceVerifier: payload.pv,
      redirectTo: typeof payload.rt === "string" ? payload.rt : "",
    };
  } catch {
    return null;
  }
}

const CONNECTIONS_TTL = "365d";

export async function signConnectionsToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("connections")
    .setIssuedAt()
    .setExpirationTime(CONNECTIONS_TTL)
    .sign(secret);
}

export async function verifyConnectionsToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      audience: "connections",
    });
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// --- Inbound webhooks ---
//
// The inbound mirror of the connections broker: instead of the pod calling OUT
// to a provider, a provider calls IN to a per-user public URL
// (`<BASE_URL>/api/inbound/<token>/<path>`). The token embeds the userId (as the
// verified JWT subject, never trusted from the URL shape) so the public route
// can resolve which pod to wake + forward into without a session. Long-lived,
// like the connections/compute/backup tokens — it's handed to external
// providers (as part of a URL) rather than the pod, so it never needs rotation
// on its own; disabling a binding is a `webhook_bindings` row operation, not a
// token operation.

const INBOUND_TTL = "365d";

export async function signInboundToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("inbound")
    .setIssuedAt()
    .setExpirationTime(INBOUND_TTL)
    .sign(secret);
}

export async function verifyInboundToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      audience: "inbound",
    });
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
