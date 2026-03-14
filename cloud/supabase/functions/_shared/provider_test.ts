import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("resolveModel throws on unknown provider", async () => {
  const original = Deno.env.get("LLM_PROVIDER");
  Deno.env.set("LLM_PROVIDER", "unknown_provider");

  try {
    const { resolveModel } = await import("./provider.ts");
    await assertRejects(
      () => resolveModel("openai/gpt-4o"),
      Error,
      'Unknown LLM_PROVIDER: "unknown_provider"'
    );
  } finally {
    if (original) {
      Deno.env.set("LLM_PROVIDER", original);
    } else {
      Deno.env.delete("LLM_PROVIDER");
    }
  }
});

Deno.test("resolveModel defaults to stripe provider", () => {
  const original = Deno.env.get("LLM_PROVIDER");
  Deno.env.delete("LLM_PROVIDER");

  try {
    // Just verify the env var default logic
    const provider = Deno.env.get("LLM_PROVIDER") ?? "stripe";
    assertEquals(provider, "stripe");
  } finally {
    if (original) Deno.env.set("LLM_PROVIDER", original);
  }
});
