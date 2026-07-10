# Auth (bring-your-own bot token)

lmthing does **not** broker OAuth for Telegram. The user creates their own bot with **@BotFather**
and pastes two values into **the project's Settings → Integrations**, which stores each as a private
environment variable on the pod:

- **`TELEGRAM_BOT_TOKEN`** — the bot token from BotFather (looks like `123456789:AA...`). It is used
  for every outbound call.
- **`TELEGRAM_WEBHOOK_SECRET`** — a random string the user chooses and registers with `setWebhook`.
  It is used only to verify inbound webhooks (see below).

## Outbound calls

The Telegram Bot API carries the token **in the URL path** (`https://api.telegram.org/bot<token>/<method>`),
not in a header — so the connection auth style is `none`. On every `callConnection('telegram', ...)`
the pod:

1. Reads the user's `TELEGRAM_BOT_TOKEN` from the pod env.
2. Pins the host+base to `https://api.telegram.org/bot<token>` (token substituted into the base).
3. Forwards your relative `path` (e.g. `/sendMessage`) + `body`/`query`.
4. Returns `{ ok, status, data }` — `status` is the HTTP status; **Telegram's own success flag is
   `data.ok`** (Telegram usually returns HTTP 200 even on logical errors, with `data.ok === false`
   and a `description`; a bad token yields `401 Unauthorized`).

If the token is missing, `callConnection` throws ("not configured — set TELEGRAM_BOT_TOKEN in
Settings → Integrations"). In that case ask the user to add their bot token — do not authenticate
yourself and do not fabricate a result.

## Inbound webhook verification

For inbound updates the pod verifies each request **pod-side** (declaratively, no agent code): when
the user runs `setWebhook` with `secret_token=<TELEGRAM_WEBHOOK_SECRET>`, Telegram sends that value
back on every webhook in the `X-Telegram-Bot-Api-Secret-Token` header. The pod compares it against
the stored `TELEGRAM_WEBHOOK_SECRET` and rejects mismatches — so the agent can trust that any update
it receives is genuinely from Telegram.
