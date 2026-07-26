import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The token module reads GATEWAY_JWT_SECRET at import time, so it has to be
    // present before any test file's imports are evaluated.
    env: {
      GATEWAY_JWT_SECRET: Buffer.from("test-secret-not-a-real-key").toString(
        "base64",
      ),
      // The tier table reads its Stripe price ids from env at import time; the
      // webhook tests need a paid tier that getTierByPriceId can resolve.
      STRIPE_PRICE_BASIC: "price_test_basic",
      STRIPE_PRICE_PRO: "price_test_pro",
      STRIPE_PRICE_MAX: "price_test_max",
    },
  },
});
