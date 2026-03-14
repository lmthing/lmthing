import { corsHeaders } from "../_shared/cors.ts";
import { getStripe, isLocalDev } from "../_shared/stripe.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getContainer } from "../_shared/container.ts";

const COMPUTER_PRICE_ID = Deno.env.get("COMPUTER_PRICE_ID") ?? "";

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

        // Auto-provision computer if this is a new active Computer tier subscription.
        // Dispatched asynchronously — sets status to "provisioning" in the DB and
        // performs the Fly.io orchestration in the background so we can respond
        // to Stripe quickly.
        if (status === "active") {
          const hasComputerItem = subscription.items.data.some(
            (item: any) => item.price.id === COMPUTER_PRICE_ID
          );

          if (hasComputerItem) {
            // Fire-and-forget: mark as provisioning and do Fly.io work async
            scheduleProvision(supabase, profile.id).catch((err) =>
              console.error(`Failed to schedule computer provision for ${profile.id}:`, err)
            );
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
          // Fire-and-forget: destroy in background so we respond quickly
          destroyComputerForUser(supabase, profile.id).catch((err) =>
            console.error(`Failed to destroy computer for ${profile.id}:`, err)
          );
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  // Respond to Stripe immediately — provisioning/teardown happens in background
  return new Response(
    JSON.stringify({ received: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});

/**
 * Schedule async computer provisioning.
 * Marks the computer as "provisioning" in the DB immediately, then performs
 * the Fly.io orchestration in the background (fire-and-forget from the
 * webhook's perspective).
 */
async function scheduleProvision(
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

  // Call provision-computer edge function to handle the actual Fly.io work.
  // This runs as a separate invocation with its own timeout.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/provision-computer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "x-webhook-provision": "true",
      },
      body: JSON.stringify({ user_id: userId, region: "iad" }),
    });

    if (!res.ok) {
      console.error(`provision-computer returned ${res.status} for ${userId}`);
    }
  } catch (err) {
    console.error(`Failed to call provision-computer for ${userId}:`, err);
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
