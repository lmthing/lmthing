import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getContainer } from "../_shared/container.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    const supabase = createServiceClient();

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: { message: "id is required" } }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("spaces")
      .select("user_id, fly_machine_id, fly_app_name, fly_volume_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: { message: "Space not found" } }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Destroy Fly.io resources if they exist
    if (existing.fly_app_name) {
      const container = getContainer();
      try {
        if (existing.fly_machine_id) {
          await container.destroyMachine(
            existing.fly_app_name,
            existing.fly_machine_id,
          );
        }
        if (existing.fly_volume_id) {
          await container.deleteVolume(
            existing.fly_app_name,
            existing.fly_volume_id,
          );
        }
        await container.deleteApp(existing.fly_app_name);
      } catch {
        // Best-effort cleanup — continue with soft-delete even if Fly cleanup fails
      }
    }

    // Soft-delete: set status to 'destroyed'
    const { error } = await supabase
      .from("spaces")
      .update({ status: "destroyed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: { message } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
