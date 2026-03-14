import { corsHeaders } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { isLocalDev } from "../_shared/stripe.ts";

const AVAILABLE_MODELS = [
  // OpenAI
  { id: "openai/gpt-4o", owned_by: "openai" },
  { id: "openai/gpt-4o-mini", owned_by: "openai" },
  { id: "openai/gpt-4.1", owned_by: "openai" },
  { id: "openai/gpt-4.1-mini", owned_by: "openai" },
  { id: "openai/o3", owned_by: "openai" },
  { id: "openai/o3-mini", owned_by: "openai" },
  // Anthropic
  { id: "anthropic/claude-sonnet-4", owned_by: "anthropic" },
  { id: "anthropic/claude-opus-4", owned_by: "anthropic" },
  { id: "anthropic/claude-3-5-haiku", owned_by: "anthropic" },
  // Google
  { id: "google/gemini-2.5-pro", owned_by: "google" },
  { id: "google/gemini-2.5-flash", owned_by: "google" },
];

async function getOllamaModels(): Promise<
  { id: string; owned_by: string }[] | null
> {
  const baseURL =
    Deno.env.get("OLLAMA_BASE_URL") ?? "http://localhost:11434/v1";
  // Convert /v1 base to Ollama's native /api/tags endpoint
  const apiBase = baseURL.replace(/\/v1\/?$/, "");
  try {
    const res = await fetch(`${apiBase}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => ({
      id: m.name,
      owned_by: "ollama",
    }));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require auth to list models
    await getUser(req);

    const now = Math.floor(Date.now() / 1000);
    const provider = Deno.env.get("LLM_PROVIDER") ?? "stripe";

    let models = AVAILABLE_MODELS;

    // When running locally with Ollama, try to fetch actually available models
    if (isLocalDev && provider === "ollama") {
      const ollamaModels = await getOllamaModels();
      if (ollamaModels && ollamaModels.length > 0) {
        models = ollamaModels;
      }
    }

    const data = models.map((m) => ({
      id: m.id,
      object: "model" as const,
      created: now,
      owned_by: m.owned_by,
    }));

    return new Response(JSON.stringify({ object: "list", data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: { message } }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
