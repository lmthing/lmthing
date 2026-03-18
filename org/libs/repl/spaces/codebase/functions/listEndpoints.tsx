/**
 * Lists all cloud edge function endpoints with their methods, purposes, and auth requirements.
 *
 * @returns Array of endpoint objects with method, path, purpose, and auth info
 */

const endpoints = [
  { name: "generate-ai", method: "POST", purpose: "Streaming LLM proxy via Stripe", auth: "jwt|apikey", category: "AI" },
  { name: "list-models", method: "GET", purpose: "Available models from all providers", auth: "jwt|apikey", category: "AI" },
  { name: "create-api-key", method: "POST", purpose: "Generate lmt_ prefixed API key", auth: "jwt", category: "API Keys" },
  { name: "list-api-keys", method: "GET", purpose: "List key prefixes and metadata", auth: "jwt", category: "API Keys" },
  { name: "revoke-api-key", method: "POST", purpose: "Soft-delete an API key", auth: "jwt", category: "API Keys" },
  { name: "create-checkout", method: "POST", purpose: "Create Stripe checkout session", auth: "jwt", category: "Billing" },
  { name: "billing-portal", method: "POST", purpose: "Open Stripe customer portal", auth: "jwt", category: "Billing" },
  { name: "get-usage", method: "GET", purpose: "Stripe balance and usage meters", auth: "jwt|apikey", category: "Billing" },
  { name: "stripe-webhook", method: "POST", purpose: "Stripe webhooks + computer provisioning", auth: "none (Stripe signature)", category: "Billing" },
  { name: "create-sso-code", method: "POST", purpose: "Generate SSO authorization code (60s TTL)", auth: "jwt", category: "SSO" },
  { name: "exchange-sso-code", method: "POST", purpose: "Exchange SSO code for session", auth: "none (code is credential)", category: "SSO" },
  { name: "list-spaces", method: "GET", purpose: "List user's deployed spaces", auth: "jwt|apikey", category: "Spaces" },
  { name: "create-space", method: "POST", purpose: "Create space + provision Fly.io machine", auth: "jwt|apikey", category: "Spaces" },
  { name: "get-space", method: "GET", purpose: "Get space by slug", auth: "none (public)", category: "Spaces" },
  { name: "update-space", method: "PATCH", purpose: "Update space metadata", auth: "jwt|apikey", category: "Spaces" },
  { name: "start-space", method: "POST", purpose: "Start space's Fly.io machine", auth: "jwt|apikey", category: "Spaces" },
  { name: "stop-space", method: "POST", purpose: "Stop space's Fly.io machine", auth: "jwt|apikey", category: "Spaces" },
  { name: "delete-space", method: "POST", purpose: "Destroy space resources", auth: "jwt|apikey", category: "Spaces" },
  { name: "issue-space-token", method: "POST", purpose: "Issue short-lived space access token", auth: "jwt|apikey", category: "Spaces" },
  { name: "provision-computer", method: "POST", purpose: "Provision Fly.io computer machine", auth: "jwt|apikey", category: "Computer" },
  { name: "issue-computer-token", method: "POST", purpose: "Issue short-lived computer access token", auth: "jwt|apikey", category: "Computer" },
];

export function listEndpoints(category?: string) {
  if (category) {
    const filtered = endpoints.filter(
      (e) => e.category.toLowerCase() === category.toLowerCase()
    );
    return filtered.length > 0
      ? filtered
      : { error: `No endpoints in category "${category}". Available: ${[...new Set(endpoints.map((e) => e.category))].join(", ")}` };
  }
  return endpoints;
}
