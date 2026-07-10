---
variable: demoApi
description: The demo echo endpoint reached via callConnection('demo', ...) — base URL, the two methods the wrapper functions use, and the bring-your-own-token auth model. Exists to exercise the lmthing integration engine end-to-end.
---

# Demo (Echo) endpoint cheat-sheet

The agent talks to the user's own echo endpoint through `callConnection('demo', req)`. The pod pins
the base URL to the user's **`INTEGRATION_DEMO_BASE_URL`** (e.g. a `https://webhook.site/<id>` URL) and attaches
their **`INTEGRATION_DEMO_API_TOKEN`** as an `Authorization: Bearer` header — the agent passes only a RELATIVE
`path` and never handles credentials.

Wrapped methods:

- **`POST /messages`** — send a message `{ chat_id, text }` (`demoSendMessage`).
- **`GET /health`** — check the endpoint is configured and reachable (`demoGetHealth`).

Inbound: the demo endpoint (or a test harness) POSTs a signed webhook to the lmthing inbound URL. The
pod verifies it with HMAC-SHA256 over the raw body (`x-demo-signature: sha256=<hex>`) using the
user's `INTEGRATION_DEMO_WEBHOOK_SECRET`, then hands the raw payload to the Demo Channel agent, which replies via
`demoSendMessage`. See the `auth` aspect for the token model and `endpoints` for exact shapes.
