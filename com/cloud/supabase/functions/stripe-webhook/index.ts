import { corsHeaders } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      // Could notify the user, block further usage, etc.
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

      // Update profile with subscription status if needed
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (profile) {
        console.log(`Subscription ${status} for user ${profile.id}`);
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
