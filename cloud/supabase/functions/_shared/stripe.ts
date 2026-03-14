import Stripe from "npm:stripe@17";

export const isLocalDev = Deno.env.get("LOCAL_DEV") === "true";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (isLocalDev) {
    throw new Error("getStripe() should not be called in local dev mode");
  }
  if (!_stripe) {
    _stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

/**
 * Ensure a user has a Stripe customer ID. Creates one if missing.
 * In local dev mode, returns a placeholder without calling Stripe.
 */
export async function ensureStripeCustomer(
  supabase: any,
  userId: string,
  email: string,
  existingCustomerId: string | null
): Promise<string> {
  if (isLocalDev) return "cus_local_dev";
  if (existingCustomerId) return existingCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({ email });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}
