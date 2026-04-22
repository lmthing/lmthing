import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import type { Env } from "../types.js";

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.ZITADEL_URL}/oauth/v2/keys`),
);

export interface AuthUser {
  id: string;
  email: string;
}

export async function authMiddleware(c: Context<Env>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = header.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.ZITADEL_ISSUER,
    });

    if (!payload.sub || typeof payload.email !== "string") {
      return c.json({ error: "Invalid token claims" }, 401);
    }

    c.set("user", { id: payload.sub, email: payload.email });
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
}
