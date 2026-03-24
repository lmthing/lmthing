import { Hono } from "hono";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import { getTierByPriceId, TIERS } from "../lib/tiers.js";
import { createUserPod, deleteUserPod } from "../lib/compute.js";

const webhook = new Hono();

webhook.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature" }, 400);
  }

  const rawBody = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", msg);
    return c.json({ error: `Webhook Error: ${msg}` }, 400);
  }

  console.log(`Stripe event: ${event.type} (${event.id})`);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price?.id;
      const userId = subscription.metadata?.user_id;

      if (!userId || !priceId) {
        console.warn("Subscription event missing user_id or price_id");
        break;
      }

      const match = getTierByPriceId(priceId);
      if (!match) {
        console.warn(`Unknown price_id: ${priceId}`);
        break;
      }

      const [tierName, tier] = match;
      console.log(`Upgrading user ${userId} to ${tierName}`);

      try {
        await litellm.updateUserTier(userId, tier);
        console.log(`User ${userId} upgraded to ${tierName}`);
      } catch (err) {
        console.error(`Failed to update user ${userId}:`, err);
      }

      // Create or delete compute pod based on tier
      if (tier.compute) {
        try {
          await createUserPod(userId);
          console.log(`Compute pod created for user ${userId}`);
        } catch (err) {
          console.error(`Failed to create compute pod for ${userId}:`, err);
        }
      } else {
        try {
          await deleteUserPod(userId);
        } catch (err) {
          console.error(`Failed to delete compute pod for ${userId}:`, err);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;

      if (!userId) {
        console.warn("Subscription deleted event missing user_id");
        break;
      }

      console.log(`Downgrading user ${userId} to free`);

      try {
        await litellm.updateUserTier(userId, TIERS.free);
        console.log(`User ${userId} downgraded to free`);
      } catch (err) {
        console.error(`Failed to downgrade user ${userId}:`, err);
      }

      // Delete compute pod on subscription cancellation
      try {
        await deleteUserPod(userId);
      } catch (err) {
        console.error(`Failed to delete compute pod for ${userId}:`, err);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return c.json({ received: true });
});

export default webhook;
