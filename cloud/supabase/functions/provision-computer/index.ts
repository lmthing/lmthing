import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  getContainer,
  FLY_ORG,
  SPACE_SPEC,
  COMPUTER_TOKEN_SECRET,
} from "../_shared/container.ts";

const COMPUTER_IMAGE =
  Deno.env.get("COMPUTER_IMAGE") ?? Deno.env.get("SPACE_IMAGE") ?? "registry.fly.io/lmthing-space:latest";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    const supabase = createServiceClient();

    // Check if user already has a computer
    const { data: existing } = await supabase
      .from("computers")
      .select("id, status")
      .eq("user_id", user.id)
      .single();

    if (existing && existing.status !== "failed" && existing.status !== "destroyed") {
      return new Response(
        JSON.stringify({
          error: { message: "Computer already provisioned" },
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const region = body.region || "iad";
    const shortId = user.id.replace(/-/g, "").slice(0, 12);
    const flyAppName = `lmt-computer-${shortId}`;

    // Upsert computer record
    const { data: computer, error: dbError } = await supabase
      .from("computers")
      .upsert(
        {
          user_id: user.id,
          fly_app_name: flyAppName,
          region,
          status: "provisioning",
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (dbError) throw dbError;

    // Provision in background
    provisionComputer(supabase, computer.id, {
      appName: flyAppName,
      region,
      userId: user.id,
    });

    return new Response(JSON.stringify(computer), {
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

async function provisionComputer(
  supabase: ReturnType<typeof createServiceClient>,
  computerId: string,
  opts: { appName: string; region: string; userId: string },
) {
  const container = getContainer();

  try {
    await container.createApp({ name: opts.appName, org: FLY_ORG });

    const volume = await container.createVolume({
      appName: opts.appName,
      name: "computer_data",
      region: opts.region,
      sizeGb: 1,
    });

    const machine = await container.createMachine({
      appName: opts.appName,
      name: `${opts.appName}-main`,
      region: opts.region,
      image: COMPUTER_IMAGE,
      spec: SPACE_SPEC,
      env: {
        USER_ID: opts.userId,
        RUNTIME_MODE: "computer",
        TOKEN_SECRET: COMPUTER_TOKEN_SECRET,
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
        user_id: opts.userId,
        mode: "computer",
      },
    });

    await container.waitForState(opts.appName, machine.id, "started", 60_000);

    await supabase
      .from("computers")
      .update({
        fly_machine_id: machine.id,
        fly_volume_id: volume.id,
        status: "running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", computerId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("computers")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", computerId);
  }
}
