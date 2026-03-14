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

    // Verify ownership and get machine info
    const { data: space } = await supabase
      .from("spaces")
      .select("user_id, fly_app_name, fly_machine_id, status")
      .eq("id", id)
      .single();

    if (!space || space.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: { message: "Space not found" } }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!space.fly_app_name || !space.fly_machine_id) {
      return new Response(
        JSON.stringify({ error: { message: "Space has no provisioned machine" } }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (space.status === "stopped") {
      return new Response(
        JSON.stringify({ error: { message: "Space is already stopped" } }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const container = getContainer();
    await container.stopMachine(space.fly_app_name, space.fly_machine_id);
    await container.waitForState(
      space.fly_app_name,
      space.fly_machine_id,
      "stopped",
      30_000,
    );

    await supabase
      .from("spaces")
      .update({ status: "stopped", updated_at: new Date().toISOString() })
      .eq("id", id);

    return new Response(JSON.stringify({ success: true, status: "stopped" }), {
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
