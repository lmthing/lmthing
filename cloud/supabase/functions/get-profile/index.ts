import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    const supabase = createServiceClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, github_repo, github_username, stripe_customer_id, created_at")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return new Response(
        JSON.stringify({ error: { message: "Profile not found" } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        github_repo: profile.github_repo,
        github_username: profile.github_username,
        has_stripe: !!profile.stripe_customer_id,
        created_at: profile.created_at,
        needs_onboarding: !profile.github_repo,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: { message } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
