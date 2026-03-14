import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  getContainer,
  spaceAppName,
  FLY_ORG,
  SPACE_IMAGE,
  SPACE_SPEC,
  SPACE_TOKEN_SECRET,
} from "../_shared/container.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    const supabase = createServiceClient();

    const body = await req.json();
    const { name, slug, description, region } = body;

    if (!name || !slug) {
      return new Response(
        JSON.stringify({ error: { message: "name and slug are required" } }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate slug format (lowercase alphanumeric + hyphens)
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length < 2) {
      return new Response(
        JSON.stringify({
          error: { message: "slug must be lowercase alphanumeric with hyphens" },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const spaceRegion = region || "iad";
    const dbSchema = `space_${crypto.randomUUID().replace(/-/g, "")}`;
    const flyAppName = spaceAppName(slug, user.id);

    // Insert space record
    const { data: space, error } = await supabase
      .from("spaces")
      .insert({
        user_id: user.id,
        name,
        slug,
        description: description || null,
        region: spaceRegion,
        status: "provisioning",
        db_schema: dbSchema,
        fly_app_name: flyAppName,
      })
      .select()
      .single();

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return new Response(
        JSON.stringify({ error: { message: error.message } }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create DB schema for this space
    await supabase.rpc("create_space_schema", { schema_name: dbSchema });

    // Provision Fly.io app + machine (async — update status on completion)
    provisionMachine(supabase, space.id, {
      appName: flyAppName,
      region: spaceRegion,
      spaceId: space.id,
      userId: user.id,
    });

    return new Response(JSON.stringify(space), {
      status: 201,
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

/**
 * Provision a Fly.io app and machine in the background.
 * Updates the space record with machine IDs and status on completion.
 */
async function provisionMachine(
  supabase: ReturnType<typeof createServiceClient>,
  spaceId: string,
  opts: { appName: string; region: string; spaceId: string; userId: string },
) {
  const container = getContainer();

  try {
    // 1. Create the Fly app
    await container.createApp({ name: opts.appName, org: FLY_ORG });

    // 2. Create a persistent volume
    const volume = await container.createVolume({
      appName: opts.appName,
      name: "space_data",
      region: opts.region,
      sizeGb: 1,
    });

    // 3. Create the machine
    const machine = await container.createMachine({
      appName: opts.appName,
      name: `${opts.appName}-main`,
      region: opts.region,
      image: SPACE_IMAGE,
      spec: SPACE_SPEC,
      env: {
        SPACE_ID: opts.spaceId,
        USER_ID: opts.userId,
        TOKEN_SECRET: SPACE_TOKEN_SECRET,
      },
      volumes: [{ volumeId: volume.id, path: "/data" }],
      services: [
        {
          internalPort: 8080,
          protocol: "tcp",
          ports: [
            { port: 80, handlers: ["http"], forceHttps: true },
            { port: 443, handlers: ["tls", "http"] },
          ],
        },
      ],
      metadata: {
        space_id: opts.spaceId,
        user_id: opts.userId,
      },
    });

    // 4. Wait for the machine to start
    await container.waitForState(opts.appName, machine.id, "started", 60_000);

    // 5. Update space record with provisioned IDs
    await supabase
      .from("spaces")
      .update({
        fly_machine_id: machine.id,
        fly_volume_id: volume.id,
        status: "running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", spaceId);
  } catch (err) {
    // Mark space as failed
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("spaces")
      .update({
        status: "failed",
        app_config: { provision_error: message },
        updated_at: new Date().toISOString(),
      })
      .eq("id", spaceId);
  }
}
