import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Create a Supabase client with the service role key (admin access, bypasses RLS).
 */
export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Create a Supabase client scoped to the authenticated user (respects RLS).
 */
export function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
    }
  );
}
