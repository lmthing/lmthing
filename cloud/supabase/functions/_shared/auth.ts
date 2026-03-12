import { createServiceClient } from "./supabase.ts";

export interface AuthUser {
  id: string;
  email: string;
  stripeCustomerId: string | null;
}

/**
 * Verify the JWT from the Authorization header and return user info.
 * For API key auth (lmt_ prefix), look up the user by key hash.
 */
export async function getUser(req: Request): Promise<AuthUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  const supabase = createServiceClient();

  // API key auth
  if (token.startsWith("lmt_")) {
    const keyHash = await hashApiKey(token);
    const { data: apiKey, error } = await supabase
      .from("api_keys")
      .select("user_id")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (error || !apiKey) throw new Error("Invalid API key");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, stripe_customer_id")
      .eq("id", apiKey.user_id)
      .single();

    if (!profile) throw new Error("User not found");

    return {
      id: profile.id,
      email: profile.email,
      stripeCustomerId: profile.stripe_customer_id,
    };
  }

  // JWT auth
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid or expired token");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("User profile not found");

  return {
    id: profile.id,
    email: profile.email,
    stripeCustomerId: profile.stripe_customer_id,
  };
}

async function hashApiKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
