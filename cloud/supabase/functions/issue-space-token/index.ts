import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const TOKEN_SECRET = Deno.env.get("SPACE_TOKEN_SECRET") ?? Deno.env.get("COMPUTER_TOKEN_SECRET") ?? "";
const TOKEN_TTL_SECONDS = 300; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    const supabase = createServiceClient();

    const body = await req.json();
    const { spaceId } = body;

    if (!spaceId) {
      return new Response(
        JSON.stringify({ error: { message: "spaceId is required" } }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user owns the space
    const { data: space, error } = await supabase
      .from("spaces")
      .select("id, fly_app_name, status")
      .eq("id", spaceId)
      .eq("user_id", user.id)
      .single();

    if (error || !space) {
      return new Response(
        JSON.stringify({ error: { message: "Space not found or access denied" } }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (space.status !== "running") {
      return new Response(
        JSON.stringify({ error: { message: `Space is not running (status: ${space.status})` } }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generate HMAC-signed short-lived token
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TOKEN_TTL_SECONDS;
    const payload = JSON.stringify({ user_id: user.id, space_id: spaceId, iat, exp });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(TOKEN_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload),
    );

    const sigHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const token = `${btoa(payload)}.${sigHex}`;
    const appHost = space.fly_app_name ? `${space.fly_app_name}.fly.dev` : null;

    return new Response(
      JSON.stringify({ token, appHost, expiresAt: exp }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: { message } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
