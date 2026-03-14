import type { LanguageModelV2 } from "npm:ai@5";

/**
 * Resolve a model string (e.g. "openai/gpt-4o") into an AI SDK LanguageModelV2.
 *
 * The backend is selected by the LLM_PROVIDER env var:
 *   - "stripe"  → @stripe/ai-sdk (production, routes through llm.stripe.com)
 *   - "ollama"  → @ai-sdk/openai-compatible pointed at Ollama (fully offline)
 *   - "openai"  → @ai-sdk/openai with a direct API key (no Stripe metering)
 *
 * Default: "stripe" (production behavior unchanged)
 */
export async function resolveModel(
  modelId: string,
  opts?: { stripeCustomerId?: string }
): Promise<LanguageModelV2> {
  const provider = Deno.env.get("LLM_PROVIDER") ?? "stripe";

  switch (provider) {
    case "stripe": {
      const { createStripe } = await import("npm:@stripe/ai-sdk@0.1/provider");
      const stripeLLM = createStripe({
        apiKey: Deno.env.get("STRIPE_SECRET_KEY")!,
        customerId: opts?.stripeCustomerId,
      });
      return stripeLLM(modelId);
    }

    case "ollama": {
      const { createOpenAICompatible } = await import(
        "npm:@ai-sdk/openai-compatible"
      );
      const ollama = createOpenAICompatible({
        name: "ollama",
        baseURL:
          Deno.env.get("OLLAMA_BASE_URL") ?? "http://localhost:11434/v1",
      });
      // Use OLLAMA_MODEL override, or strip provider prefix from modelId
      const localModel =
        Deno.env.get("OLLAMA_MODEL") || modelId.replace(/^[^/]+\//, "");
      return ollama(localModel);
    }

    case "openai": {
      const { createOpenAI } = await import("npm:@ai-sdk/openai");
      const openai = createOpenAI({
        apiKey: Deno.env.get("OPENAI_API_KEY")!,
      });
      // Strip provider prefix if present (e.g. "openai/gpt-4o" → "gpt-4o")
      const openaiModel = modelId.replace(/^openai\//, "");
      return openai(openaiModel);
    }

    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${provider}". Use "stripe", "ollama", or "openai".`
      );
  }
}
