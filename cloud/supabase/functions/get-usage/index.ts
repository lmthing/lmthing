import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { ensureStripeCustomer, isLocalDev } from "../_shared/stripe.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import Stripe from "npm:stripe@17";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (isLocalDev) {
    return new Response(
      JSON.stringify({
        balance_cents: 0,
        balance_display: "$0.00",
        has_credit: true,
        local_dev: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const user = await getUser(req);
    const supabase = createServiceClient();

    const stripeCustomerId = await ensureStripeCustomer(
      supabase,
      user.id,
      user.email,
      user.stripeCustomerId
    );

    // Query Stripe for the customer's current balance and usage
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-02-24.acacia",
    });

    const customer = (await stripe.customers.retrieve(
      stripeCustomerId
    )) as Stripe.Customer;

    // Customer balance is in cents (negative = credit remaining)
    const balanceCents = customer.balance ?? 0;

    return new Response(
      JSON.stringify({
        stripe_customer_id: stripeCustomerId,
        // Negative balance = credit remaining, positive = amount owed
        balance_cents: balanceCents,
        balance_display: `$${(Math.abs(balanceCents) / 100).toFixed(2)}`,
        has_credit: balanceCents < 0,
      }),
      {
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
