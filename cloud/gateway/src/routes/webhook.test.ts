import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";

/**
 * The Stripe webhook drives tier changes and pod lifecycle for BOTH kinds of
 * principal. The property that matters: a team's subscription and a member's
 * are disjoint — a team checkout writes `team_id` and no `user_id`, so nothing
 * a team buys can ever be applied to a member's own pod, or vice versa.
 */

vi.mock("../lib/stripe.js", () => ({
  stripe: { webhooks: { constructEvent: vi.fn((raw: string) => JSON.parse(raw)) } },
}));
vi.mock("../lib/litellm.js", () => ({ updateUserTier: vi.fn(async () => ({})) }));
vi.mock("../lib/compute.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/compute.js")>(
    "../lib/compute.js",
  );
  return {
    userPrincipal: actual.userPrincipal,
    teamPrincipal: actual.teamPrincipal,
    principalKey: actual.principalKey,
    ensurePod: vi.fn(async () => ({ host: "h", port: 8080 })),
    deletePod: vi.fn(async () => undefined),
  };
});

const litellm = await import("../lib/litellm.js");
const compute = await import("../lib/compute.js");
const { TIERS } = await import("../lib/tiers.js");
const { default: webhook } = await import("./webhook.js");

const app = new Hono().route("/api/stripe/webhook", webhook);

/** The price id of a real paid tier, so getTierByPriceId resolves. */
const PAID = Object.entries(TIERS).find(([, t]) => t.stripePriceId)!;
const [PAID_NAME, PAID_TIER] = PAID;

function send(event: unknown) {
  return app.request("/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: JSON.stringify(event),
  });
}

const subscription = (metadata: Record<string, string>) => ({
  type: "customer.subscription.created",
  id: "evt_1",
  data: {
    object: {
      metadata,
      items: { data: [{ price: { id: PAID_TIER.stripePriceId } }] },
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("subscription created/updated", () => {
  it("applies a member's subscription to their own pod", async () => {
    const res = await send(subscription({ user_id: "379847", tier: PAID_NAME }));
    expect(res.status).toBe(200);
    // A user's principal key stays their bare id — the pre-teams behaviour.
    expect(vi.mocked(litellm.updateUserTier)).toHaveBeenCalledWith("379847", PAID_TIER);
    expect(vi.mocked(compute.ensurePod)).toHaveBeenCalledWith(
      { kind: "user", id: "379847" },
      PAID_TIER.pod,
    );
  });

  it("applies a team's subscription to the TEAM's pod, not a member's", async () => {
    await send(subscription({ team_id: "abc-123", tier: PAID_NAME }));
    expect(vi.mocked(litellm.updateUserTier)).toHaveBeenCalledWith(
      "team-abc-123",
      PAID_TIER,
    );
    expect(vi.mocked(compute.ensurePod)).toHaveBeenCalledWith(
      { kind: "team", id: "abc-123" },
      PAID_TIER.pod,
    );
  });

  it("prefers the team when a subscription somehow carries both", async () => {
    // Shouldn't happen — checkout writes one or the other — but if it does, the
    // team is the payer and a member must not be charged for it.
    await send(subscription({ team_id: "abc-123", user_id: "379847" }));
    expect(vi.mocked(compute.ensurePod)).toHaveBeenCalledWith(
      { kind: "team", id: "abc-123" },
      PAID_TIER.pod,
    );
  });

  it("ignores a subscription with no principal at all", async () => {
    const res = await send(subscription({}));
    expect(res.status).toBe(200);
    expect(vi.mocked(compute.ensurePod)).not.toHaveBeenCalled();
    expect(vi.mocked(litellm.updateUserTier)).not.toHaveBeenCalled();
  });

  it("ignores an unknown price id rather than guessing a tier", async () => {
    await send({
      type: "customer.subscription.created",
      id: "evt_2",
      data: {
        object: {
          metadata: { team_id: "abc-123" },
          items: { data: [{ price: { id: "price_not_ours" } }] },
        },
      },
    });
    expect(vi.mocked(compute.ensurePod)).not.toHaveBeenCalled();
  });
});

describe("subscription deleted", () => {
  const deleted = (metadata: Record<string, string>) => ({
    type: "customer.subscription.deleted",
    id: "evt_3",
    data: { object: { metadata } },
  });

  it("downgrades a team to free and tears down the team's pod", async () => {
    await send(deleted({ team_id: "abc-123" }));
    expect(vi.mocked(litellm.updateUserTier)).toHaveBeenCalledWith(
      "team-abc-123",
      TIERS.free,
    );
    expect(vi.mocked(compute.deletePod)).toHaveBeenCalledWith({
      kind: "team",
      id: "abc-123",
    });
  });

  it("still tears down a member's own pod unchanged", async () => {
    await send(deleted({ user_id: "379847" }));
    expect(vi.mocked(compute.deletePod)).toHaveBeenCalledWith({
      kind: "user",
      id: "379847",
    });
  });
});
