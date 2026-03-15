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
    const updates: Record<string, unknown> = {};

    // Only allow updating specific fields
    if (typeof body.github_repo === "string") {
      const repo = body.github_repo.trim();
      if (!repo) {
        return new Response(
          JSON.stringify({ error: { message: "github_repo cannot be empty" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updates.github_repo = repo;
    }

    if (typeof body.github_username === "string") {
      updates.github_username = body.github_username.trim();
    }

    if (typeof body.display_name === "string") {
      updates.display_name = body.display_name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: { message: "No valid fields to update" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true }),
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
