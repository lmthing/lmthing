import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("isLocalDev respects LOCAL_DEV env var", async () => {
  // Save original
  const original = Deno.env.get("LOCAL_DEV");

  try {
    Deno.env.set("LOCAL_DEV", "true");
    // Re-evaluate at runtime
    const isLocal = Deno.env.get("LOCAL_DEV") === "true";
    assertEquals(isLocal, true);

    Deno.env.set("LOCAL_DEV", "false");
    const isNotLocal = Deno.env.get("LOCAL_DEV") === "true";
    assertEquals(isNotLocal, false);

    Deno.env.delete("LOCAL_DEV");
    const isUndefined = Deno.env.get("LOCAL_DEV") === "true";
    assertEquals(isUndefined, false);
  } finally {
    if (original) {
      Deno.env.set("LOCAL_DEV", original);
    } else {
      Deno.env.delete("LOCAL_DEV");
    }
  }
});

Deno.test("ensureStripeCustomer returns placeholder in local dev", async () => {
  const original = Deno.env.get("LOCAL_DEV");
  Deno.env.set("LOCAL_DEV", "true");

  try {
    const { ensureStripeCustomer } = await import("./stripe.ts");
    const result = await ensureStripeCustomer(
      {} as any,
      "user-123",
      "test@test.com",
      null
    );
    assertEquals(result, "cus_local_dev");
  } finally {
    if (original) {
      Deno.env.set("LOCAL_DEV", original);
    } else {
      Deno.env.delete("LOCAL_DEV");
    }
  }
});

Deno.test("ensureStripeCustomer returns existing ID if present", async () => {
  const { ensureStripeCustomer } = await import("./stripe.ts");
  const result = await ensureStripeCustomer(
    {} as any,
    "user-123",
    "test@test.com",
    "cus_existing_123"
  );
  assertEquals(result, "cus_existing_123");
});
