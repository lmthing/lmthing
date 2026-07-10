# Auth (bring-your-own token)

lmthing does **not** broker OAuth for WhatsApp. The user creates their own Meta app, adds the
WhatsApp product, and pastes four values into **the project's Settings → Integrations**, each of
which becomes a private pod environment variable:

- `INTEGRATION_WHATSAPP_TOKEN` — the access token (a System User permanent token is recommended for production).
- `INTEGRATION_WHATSAPP_PHONE_ID` — the Phone number ID of their WhatsApp Business number.
- `INTEGRATION_WHATSAPP_APP_SECRET` — the Meta app secret (used to verify inbound webhook signatures).
- `INTEGRATION_WHATSAPP_VERIFY_TOKEN` — a random string the user also enters in Meta's webhook config; the pod
  uses it to answer Meta's GET verification challenge automatically.

On every `callConnection('whatsapp', ...)` the pod:

1. Reads the user's `INTEGRATION_WHATSAPP_TOKEN` and `INTEGRATION_WHATSAPP_PHONE_ID` from the pod env.
2. Pins the host+base to `https://graph.facebook.com/v20.0/<INTEGRATION_WHATSAPP_PHONE_ID>` and appends your
   relative `path` (`/messages`).
3. Attaches `Authorization: Bearer <INTEGRATION_WHATSAPP_TOKEN>`.
4. Returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP response; **Meta's own error is in
   `data.error`** (a non-2xx response, or any response carrying an `error` object, is a failure such
   as `190` invalid/expired token or `131047` outside the 24-hour window).

If the token isn't configured, `callConnection` throws ("not configured — set INTEGRATION_WHATSAPP_TOKEN in
Settings → Integrations"). In that case, ask the user to add their WhatsApp credentials in **the
project's Settings → Integrations** — do not attempt to authenticate yourself and do not fabricate a
result.

**Inbound webhooks** are verified pod-side from the `webhook` descriptor: Meta signs each delivery
with `X-Hub-Signature-256` (HMAC-SHA256 of the body using `INTEGRATION_WHATSAPP_APP_SECRET`), and the pod checks
it before the handler ever runs. The one-time GET subscription verification (`hub.challenge`) is also
answered by the pod using `INTEGRATION_WHATSAPP_VERIFY_TOKEN`. The user just points Meta's webhook at their
lmthing inbound URL and subscribes to the `messages` field.
