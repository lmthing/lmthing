import type { Context, Next } from "hono";
import type { Env } from "../types.js";

const ZITADEL_URL = process.env.ZITADEL_URL!;
const CLIENT_ID = process.env.ZITADEL_CLIENT_ID!;
const CLIENT_SECRET = process.env.ZITADEL_CLIENT_SECRET!;

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
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const res = await fetch(`${ZITADEL_URL}/oauth/v2/introspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ token }),
    });

    if (!res.ok) {
      return c.json({ error: "Token introspection failed" }, 401);
    }

    const payload = (await res.json()) as {
      active: boolean;
      sub?: string;
      email?: string;
    };

    if (!payload.active || !payload.sub || typeof payload.email !== "string") {
      return c.json({ error: "Invalid or inactive token" }, 401);
    }

    c.set("user", { id: payload.sub, email: payload.email });
  } catch {
    return c.json({ error: "Token validation failed" }, 401);
  }

  await next();
}
