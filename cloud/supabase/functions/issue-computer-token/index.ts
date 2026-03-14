import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { getStripe } from "../_shared/stripe.ts";

const COMPUTER_PRICE_ID = Deno.env.get("COMPUTER_PRICE_ID") ?? "";
const TOKEN_SECRET = Deno.env.get("COMPUTER_TOKEN_SECRET") ?? "";
const TOKEN_TTL_SECONDS = 300; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);

    if (!user.stripeCustomerId) {
      return new Response(
        JSON.stringify({
          error: { message: "No billing account. Subscribe to Computer tier first." },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify active Computer tier subscription via Stripe
    const stripe = getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 100,
    });

    const hasComputerTier = subscriptions.data.some((sub) =>
      sub.items.data.some((item) => item.price.id === COMPUTER_PRICE_ID)
    );

    if (!hasComputerTier) {
      return new Response(
        JSON.stringify({
          error: { message: "Computer tier subscription required." },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate HMAC-signed short-lived token
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TOKEN_TTL_SECONDS;
    const payload = JSON.stringify({ user_id: user.id, iat, exp });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(TOKEN_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );

    const sigHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Token format: base64(payload).sigHex
    const token = `${btoa(payload)}.${sigHex}`;

    return new Response(
      JSON.stringify({ token, expiresAt: exp }),
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
