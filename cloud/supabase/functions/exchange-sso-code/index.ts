import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: { message: "code and redirect_uri are required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createServiceClient();

    // Look up the code
    const { data: ssoCode, error: lookupError } = await supabase
      .from("sso_codes")
      .select("*")
      .eq("code", code)
      .is("used_at", null)
      .single();

    if (lookupError || !ssoCode) {
      return new Response(
        JSON.stringify({ error: { message: "Invalid or expired code" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(ssoCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: { message: "Code has expired" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate redirect_uri matches
    if (ssoCode.redirect_uri !== redirect_uri) {
      return new Response(
        JSON.stringify({ error: { message: "redirect_uri mismatch" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as used (single-use)
    await supabase
      .from("sso_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", ssoCode.id);

    // Generate a session for the user using admin API
    // We use the service role to create a magic link token, then exchange it
    // This effectively creates a new session for the user
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(ssoCode.user_id);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: { message: "User not found" } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a session token pair
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
    });

    if (sessionError) throw sessionError;

    return new Response(
      JSON.stringify({
        access_token: sessionData.properties?.hashed_token,
        token_type: "bearer",
        user: {
          id: userData.user.id,
          email: userData.user.email,
        },
        verification_url: sessionData.properties?.action_link,
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
