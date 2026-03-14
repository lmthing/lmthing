import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const ALLOWED_REDIRECT_HOSTS = [
  "studio.local",
  "chat.local",
  "blog.local",
  "computer.local",
  "space.local",
  "social.local",
  "store.local",
  "team.local",
  "casa.local",
  "lmthing.studio",
  "lmthing.chat",
  "lmthing.blog",
  "lmthing.computer",
  "lmthing.space",
  "lmthing.social",
  "lmthing.store",
  "lmthing.team",
  "lmthing.casa",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    const supabase = createServiceClient();

    const { redirect_uri, app } = await req.json();
    if (!redirect_uri || !app) {
      return new Response(
        JSON.stringify({ error: { message: "redirect_uri and app are required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate redirect_uri against whitelist
    let redirectHost: string;
    try {
      redirectHost = new URL(redirect_uri).host;
    } catch {
      return new Response(
        JSON.stringify({ error: { message: "Invalid redirect_uri" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_REDIRECT_HOSTS.includes(redirectHost)) {
      return new Response(
        JSON.stringify({ error: { message: "redirect_uri not allowed" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a cryptographically random code
    const rawBytes = new Uint8Array(32);
    crypto.getRandomValues(rawBytes);
    const code = Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Store with 60-second expiry
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const { error } = await supabase.from("sso_codes").insert({
      user_id: user.id,
      code,
      redirect_uri,
      app,
      expires_at: expiresAt,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ code }),
      {
        status: 201,
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
