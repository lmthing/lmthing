# Connect Telegram

This integration lets THING **send messages through your own Telegram bot** and **reply to messages
people send that bot**. To connect it you create a free bot with Telegram's **@BotFather**, choose a
secret word, and copy two values into the fields on this page.

It takes about 5 minutes. Follow every step.

---

## What you'll need

| Field on this page | What it is | Looks like |
|---|---|---|
| **Bot token** (`INTEGRATION_TELEGRAM_BOT_TOKEN`) | Lets THING act as your Telegram bot | `123456789:AAExampleToken...` |
| **Webhook secret token** (`INTEGRATION_TELEGRAM_WEBHOOK_SECRET`) | A secret word YOU invent, so we can verify updates Telegram sends back are genuine | any random string, e.g. `s7Kd9_QpZ2` (1–256 chars, letters/digits/`_`/`-`) |

---

## Step-by-step

### 1. Create a bot with @BotFather
1. In Telegram, open a chat with **[@BotFather](https://t.me/BotFather)** (the official bot with the
   blue checkmark).
2. Send **`/newbot`**.
3. When asked, type a **name** for your bot (e.g. *THING*), then a **username** that must end in
   `bot` (e.g. `my_thing_bot`).
4. BotFather replies with your bot and a line like *"Use this token to access the HTTP API:"*
   followed by a token such as `123456789:AAE...`.
5. Copy that token into the **Bot token** field on this page.

### 2. Choose a webhook secret
Make up any random string (1–256 characters, only letters, digits, `_` and `-`), e.g.
`s7Kd9_QpZ2`. Paste the **same** value into the **Webhook secret token** field on this page. You'll
reuse it in step 4 — keep it handy.

### 3. Save
Click **Save & Restart Pod** at the bottom. Wait ~30 seconds for the pod to restart. You can now ask
THING to *"send a Telegram message to chat 12345678 saying hello"* (see step 5 for how to get a chat
id).

### 4. Point Telegram at lmthing (to RECEIVE messages)
So your bot's incoming messages reach THING, register your lmthing inbound URL as the bot's webhook.

1. Find your **inbound URL** in this project's **Settings → Integrations** — it looks like:
   `https://lmthing.cloud/api/inbound/<your-token>/telegram`
   (it always ends in `/telegram`).
2. Open this URL in a browser (or run the curl below), replacing `<TOKEN>`, `<INBOUND_URL>` and
   `<SECRET>` with your bot token, your inbound URL, and your webhook secret from step 2:

   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<INBOUND_URL>&secret_token=<SECRET>
   ```

   curl example:

   ```bash
   curl "https://api.telegram.org/bot123456789:AAE.../setWebhook?url=https://lmthing.cloud/api/inbound/abcd1234/telegram&secret_token=s7Kd9_QpZ2"
   ```

3. You should get back `{"ok":true,"result":true,"description":"Webhook was set"}`.

Telegram will now POST every incoming message to lmthing and include your secret in the
`X-Telegram-Bot-Api-Secret-Token` header, which the pod checks before delivering it to THING.

### 5. Message your bot
Open your bot in Telegram (search its `@username`) and send it any message — THING will reply.
To send messages **to** a specific chat from THING, THING needs that chat's numeric **chat id**:
the easiest way to get it is to message the bot once and let THING read `message.chat.id` from the
incoming update, or ask THING to *"tell me the chat id of the last person who messaged the bot."*

---

## Troubleshooting

- **`401 Unauthorized`** when calling the API — the **Bot token** is wrong. Recopy it from BotFather
  (send `/token` to BotFather to see it again).
- **Webhook set but messages never arrive** — the **Webhook secret token** on this page doesn't match
  the `secret_token` you passed to `setWebhook` (Telegram then gets rejected by the pod). Re-run
  step 4 using the exact value in the **Webhook secret token** field.
- **Debug the webhook** — open
  `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` in a browser. It shows the current `url`,
  whether a secret token is set, `pending_update_count`, and `last_error_message` (e.g. a wrong URL
  or an SSL problem).
- **`chat not found`** when sending — the chat id is wrong, or the user has never started a chat with
  your bot. A user must message the bot at least once before it can message them.
- **`bot was blocked by the user`** — that person blocked your bot; nothing to fix on your side.
- **Stop receiving messages** — open
  `https://api.telegram.org/bot<TOKEN>/deleteWebhook` to remove the webhook.

Tokens are stored as private environment variables on your pod and never leave it.

---

## For automations — the `message.received` event

Once connected (bot token + webhook secret saved, and the webhook URL registered in step 4), every
inbound Telegram text message this space emits an event you can hook from any project:

**`integration-telegram/message.received`**

| Payload field | Type | Value |
|---|---|---|
| `text` | `string` | The message text the user sent. |
| `from` | `string` | The sender's Telegram user id (`String(from.id)`). |
| `chatId` | `string` | The chat to reply in (`String(chat.id)`); positive = private, negative = group/channel. |
| `userName` | `string?` | The sender's `@username` (absent if they have none). |
| `threadKey` | `string?` | The originating `message_id` (Telegram has no threads). |
| `raw` | `object` | The full raw Telegram Update JSON. |

Only real, incoming **text** messages are emitted — edited messages, callback queries, service
messages, and messages from other bots are ignored.

### Automate "when a Telegram message arrives, do X"

Ask THING something like *"when a telegram message arrives, reply with a summary"* and the automator
writes a project event hook subscribed to this event. The hook reads `ctx.input` and replies in the
same chat via the space's `telegramSendMessage` function (which wraps
`callConnection('telegram', …)`):

```ts
// hooks/telegram-reply.ts — on:{ event: 'integration-telegram/message.received' }
export default async function (ctx) {
  const input = ctx.input; // { text, from, chatId, userName, threadKey, raw }
  const answer = `You said: ${input.text}`;
  // reply in the same chat, threaded under the original message
  await telegramSendMessage(input.chatId, answer, input.threadKey);
}
```

Keys (bot token + webhook secret) and a registered webhook URL are still required for events to flow —
follow steps 1–4 above first.
