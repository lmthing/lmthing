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

    // Get user info
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(ssoCode.user_id);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: { message: "User not found" } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link to get the OTP
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
    });

    if (linkError) throw linkError;

    // Verify the OTP server-side to create a proper Supabase session with a real JWT
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      email: userData.user.email!,
      token: linkData.properties?.email_otp!,
      type: "email",
    });

    if (sessionError || !sessionData.session) {
      throw new Error(sessionError?.message || "Failed to create session");
    }

    const userId = sessionData.user?.id ?? userData.user.id;

    // Fetch profile to include github_repo and onboarding status
    const { data: profile } = await supabase
      .from("profiles")
      .select("github_repo, github_username")
      .eq("id", userId)
      .single();

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        token_type: "bearer",
        expires_in: sessionData.session.expires_in,
        user: {
          id: userId,
          email: sessionData.user?.email ?? userData.user.email,
          github_repo: profile?.github_repo ?? null,
          github_username: profile?.github_username ?? null,
        },
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
