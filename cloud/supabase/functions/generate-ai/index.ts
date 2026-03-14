import { streamText } from "npm:ai@5";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { ensureStripeCustomer } from "../_shared/stripe.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { resolveModel } from "../_shared/provider.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify the user
    const user = await getUser(req);

    // 2. Ensure user has a Stripe customer ID (returns placeholder in local dev)
    const supabase = createServiceClient();
    const stripeCustomerId = await ensureStripeCustomer(
      supabase,
      user.id,
      user.email,
      user.stripeCustomerId
    );

    // 3. Parse the request body (OpenAI-compatible format)
    const body = await req.json();
    const {
      model = "openai/gpt-4o-mini",
      messages,
      temperature,
      max_tokens,
      stream = false,
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: { message: "messages array is required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Resolve the model via the provider abstraction
    const resolvedModel = await resolveModel(model, { stripeCustomerId });

    // 5. Call the model
    if (stream) {
      const result = streamText({
        model: resolvedModel,
        messages,
        temperature,
        maxTokens: max_tokens,
      });

      // Return SSE stream
      return result.toDataStreamResponse({
        headers: corsHeaders,
      });
    }

    // Non-streaming
    const { generateText } = await import("npm:ai@5");
    const result = await generateText({
      model: resolvedModel,
      messages,
      temperature,
      maxTokens: max_tokens,
    });

    // Format as OpenAI-compatible response
    const response = {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.text },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: result.usage?.promptTokens ?? 0,
        completion_tokens: result.usage?.completionTokens ?? 0,
        total_tokens: result.usage?.totalTokens ?? 0,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;

    return new Response(
      JSON.stringify({ error: { message } }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
