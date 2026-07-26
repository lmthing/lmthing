import { Hono } from "hono";
import { stripe } from "../lib/stripe.js";
import * as litellm from "../lib/litellm.js";
import { getTierByPriceId, TIERS } from "../lib/tiers.js";
import {
  ensurePod,
  deletePod,
  userPrincipal,
  teamPrincipal,
  principalKey,
  type PodPrincipal,
} from "../lib/compute.js";

/**
 * Who a subscription belongs to. A team's checkout writes `team_id` and NO
 * `user_id` (routes/teams.ts), so the two are disjoint and a team's billing can
 * never be mistaken for a member's. Everything downstream is keyed on the
 * principal, so both kinds flow through the same code.
 */
function subscriptionPrincipal(
  metadata: { user_id?: string; team_id?: string } | null | undefined,
): PodPrincipal | null {
  if (metadata?.team_id) return teamPrincipal(metadata.team_id);
  if (metadata?.user_id) return userPrincipal(metadata.user_id);
  return null;
}

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
      const principal = subscriptionPrincipal(subscription.metadata);

      if (!principal || !priceId) {
        console.warn("Subscription event missing user_id/team_id or price_id");
        break;
      }
      const key = principalKey(principal);

      const match = getTierByPriceId(priceId);
      if (!match) {
        console.warn(`Unknown price_id: ${priceId}`);
        break;
      }

      const [tierName, tier] = match;
      console.log(`Updating ${key} to tier ${tierName}`);

      try {
        await litellm.updateUserTier(key, tier);
        console.log(`${key} updated to ${tierName}`);
      } catch (err) {
        console.error(`Failed to update LiteLLM user ${key}:`, err);
      }

      // All tiers now get a compute pod. On create/update we call ensurePod
      // which is idempotent: it creates the pod if missing, wakes it if scaled to
      // zero, or patches resources to match the new tier sizing (handles both
      // upgrades and downgrades — a Free→Pro upgrade gets more CPU/mem, a
      // Pro→Free downgrade keeps the pod but shrinks it instead of removing it).
      try {
        await ensurePod(principal, tier.pod);
        console.log(`Compute pod ensured for ${key} (tier: ${tierName})`);
      } catch (err) {
        console.error(`Failed to ensure compute pod for ${key}:`, err);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const principal = subscriptionPrincipal(subscription.metadata);

      if (!principal) {
        console.warn("Subscription deleted event missing user_id/team_id");
        break;
      }
      const key = principalKey(principal);

      console.log(`Downgrading ${key} to free`);

      try {
        await litellm.updateUserTier(key, TIERS.free);
        console.log(`${key} downgraded to free`);
      } catch (err) {
        console.error(`Failed to downgrade ${key}:`, err);
      }

      // On full subscription cancellation (not a tier change) we tear down the
      // namespace entirely. The principal reverts to lazy provisioning on next
      // use — for a team, its next member visit re-provisions it on free.
      try {
        await deletePod(principal);
        console.log(`Compute pod deleted for ${key}`);
      } catch (err) {
        console.error(`Failed to delete compute pod for ${key}:`, err);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return c.json({ received: true });
});

export default webhook;
