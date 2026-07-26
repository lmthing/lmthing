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
    },
  },
});
