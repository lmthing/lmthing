import { corsHeaders } from "../_shared/cors.ts";
import { getStripe, isLocalDev } from "../_shared/stripe.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  getContainer,
  FLY_ORG,
  SPACE_SPEC,
  COMPUTER_TOKEN_SECRET,
  HEALTH_CHECK,
} from "../_shared/container.ts";

const COMPUTER_PRICE_ID = Deno.env.get("COMPUTER_PRICE_ID") ?? "";
const COMPUTER_IMAGE =
  Deno.env.get("COMPUTER_IMAGE") ?? Deno.env.get("SPACE_IMAGE") ?? "registry.fly.io/lmthing-space:latest";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (isLocalDev) {
    return new Response(
      JSON.stringify({ received: true, local_dev: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(
      JSON.stringify({ error: "Missing stripe-signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createServiceClient();

  switch (event.type) {
    // When a customer's balance hits zero (credit exhausted)
    case "billing.alert.triggered": {
      const alert = event.data.object as any;
      console.log(`Billing alert triggered for customer: ${alert.customer}`);
      break;
    }

    // When a checkout session completes (user bought credits or subscribed)
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const customerId = session.customer as string;
      console.log(`Checkout completed for customer: ${customerId}`);
      break;
    }

    // Subscription lifecycle events
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;
      const status = subscription.status;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (profile) {
        console.log(`Subscription ${status} for user ${profile.id}`);

        // Auto-provision computer if this is a new active Computer tier subscription
        if (status === "active") {
          const hasComputerItem = subscription.items.data.some(
            (item: any) => item.price.id === COMPUTER_PRICE_ID
          );

          if (hasComputerItem) {
            await provisionComputerForUser(supabase, profile.id);
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (profile) {
        console.log(`Subscription canceled for user ${profile.id}`);

        // Tear down computer if this was the Computer tier
        const hadComputerItem = subscription.items.data.some(
          (item: any) => item.price.id === COMPUTER_PRICE_ID
        );

        if (hadComputerItem) {
          await destroyComputerForUser(supabase, profile.id);
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  return new Response(
    JSON.stringify({ received: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});

/**
 * Provision a Fly.io computer machine for a user who just subscribed.
 * Skips if the user already has an active computer.
 */
async function provisionComputerForUser(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  // Check if already provisioned
  const { data: existing } = await supabase
    .from("computers")
    .select("id, status")
    .eq("user_id", userId)
    .single();

  if (existing && existing.status !== "failed" && existing.status !== "destroyed") {
    console.log(`Computer already exists for user ${userId} (status: ${existing.status})`);
    return;
  }

  const shortId = userId.replace(/-/g, "").slice(0, 12);
  const flyAppName = `lmt-computer-${shortId}`;

  const { data: computer, error: dbError } = await supabase
    .from("computers")
    .upsert(
      {
        user_id: userId,
        fly_app_name: flyAppName,
        region: "iad",
        status: "provisioning",
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (dbError) {
    console.error(`Failed to upsert computer record for ${userId}:`, dbError);
    return;
  }

  const container = getContainer();

  try {
    await container.createApp({ name: flyAppName, org: FLY_ORG });

    const volume = await container.createVolume({
      appName: flyAppName,
      name: "computer_data",
      region: "iad",
      sizeGb: 1,
    });

    const machine = await container.createMachine({
      appName: flyAppName,
      name: `${flyAppName}-main`,
      region: "iad",
      image: COMPUTER_IMAGE,
      spec: SPACE_SPEC,
      env: {
        USER_ID: userId,
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
      checks: HEALTH_CHECK,
      metadata: { user_id: userId, mode: "computer" },
    });

    await container.waitForState(flyAppName, machine.id, "started", 60_000);

    await supabase
      .from("computers")
      .update({
        fly_machine_id: machine.id,
        fly_volume_id: volume.id,
        status: "running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", computer.id);

    console.log(`Computer provisioned for user ${userId}: ${flyAppName}`);
  } catch (err) {
    console.error(`Failed to provision computer for ${userId}:`, err);
    await supabase
      .from("computers")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", computer.id);
  }
}

/**
 * Destroy the Fly.io computer for a user whose subscription was canceled.
 */
async function destroyComputerForUser(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const { data: computer } = await supabase
    .from("computers")
    .select("id, fly_app_name, fly_machine_id, fly_volume_id")
    .eq("user_id", userId)
    .single();

  if (!computer || !computer.fly_app_name) return;

  const container = getContainer();

  try {
    if (computer.fly_machine_id) {
      await container.destroyMachine(computer.fly_app_name, computer.fly_machine_id);
    }
    if (computer.fly_volume_id) {
      await container.deleteVolume(computer.fly_app_name, computer.fly_volume_id);
    }
    await container.deleteApp(computer.fly_app_name);
  } catch (err) {
    console.error(`Failed to destroy Fly resources for ${userId}:`, err);
  }

  await supabase
    .from("computers")
    .update({
      status: "destroyed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", computer.id);

  console.log(`Computer destroyed for user ${userId}`);
}
