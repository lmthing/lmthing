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

    const body = await req.json();
    const name = body.name || "Default";

    // Generate a random API key
    const rawBytes = new Uint8Array(20);
    crypto.getRandomValues(rawBytes);
    const hex = Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const rawKey = `lmt_${hex}`;
    const prefix = rawKey.slice(0, 12);

    // Hash it for storage
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(rawKey)
    );
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data, error } = await supabase
      .from("api_keys")
      .insert({ user_id: user.id, key_hash: keyHash, prefix, name })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        id: data.id,
        key: rawKey,
        prefix,
        name,
        message: "Save this key — it will not be shown again.",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
