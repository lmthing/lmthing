import { SignJWT, jwtVerify, createSecretKey } from "jose";

const secret = createSecretKey(
  Buffer.from(process.env.GATEWAY_JWT_SECRET!, "base64"),
);

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
