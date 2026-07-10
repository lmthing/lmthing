# Auth (bring-your-own-token)

lmthing does not broker any OAuth for the demo integration. You configure three values in the
project's **Settings → Integrations**, which the pod stores as environment variables:

- **`INTEGRATION_DEMO_BASE_URL`** — the base URL of your echo endpoint (e.g. `https://webhook.site/<your-id>`).
  All `callConnection('demo', …)` requests are host-pinned to this base; a relative `path` like
  `/messages` is appended.
- **`INTEGRATION_DEMO_API_TOKEN`** — attached as `Authorization: Bearer <token>` on every outbound request. The
  agent never sees it.
- **`INTEGRATION_DEMO_WEBHOOK_SECRET`** — used pod-side to verify inbound webhooks: `x-demo-signature` must equal
  `sha256=` + hex HMAC-SHA256 of the raw request body keyed by this secret.

On each outbound call the pod returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP
response; `data` is the parsed JSON (or raw text). If a value is unset, `callConnection` throws a
clear "not configured — set `<VAR>` in Settings → Integrations" error; do not fabricate a result.
