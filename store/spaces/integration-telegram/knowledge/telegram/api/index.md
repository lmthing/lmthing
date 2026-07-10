---
variable: telegramApi
description: The Telegram Bot API surface reached via callConnection('telegram', ...) — base URL, the methods the wrapper functions use, their parameters, the ok/description envelope, and the BYO-token auth model.
---

# Telegram Bot API cheat-sheet

The agent talks to the Telegram Bot API through `callConnection('telegram', req)`. The pod pins the
base URL **`https://api.telegram.org/bot<token>`** — the bot token is already part of the base
(resolved from the user's own `INTEGRATION_TELEGRAM_BOT_TOKEN`), so the agent passes only a RELATIVE `path` (a
leading-slash method name like `/sendMessage`) and never handles the token.

Wrapped methods:

- **`POST /sendMessage`** — send a text message (`telegramSendMessage`).
- **`POST /sendPhoto`** — send a photo by URL (`telegramSendPhoto`).
- **`POST /sendDocument`** — send a document/file by URL (`telegramSendDocument`).
- **`POST /sendChatAction`** — show a status like "typing…" (`telegramSendChatAction`).
- **`POST /editMessageText`** — edit a message the bot sent (`telegramEditMessageText`).
- **`POST /deleteMessage`** — delete a message (`telegramDeleteMessage`).
- **`GET /getMe`** — read the bot's own identity / validate the token (`telegramGetMe`).

Every Telegram Bot API call returns a JSON envelope with a top-level **`ok` boolean**. On success the
payload is in `result`; on failure `ok` is `false` and a human-readable `description` (plus an
`error_code`) names the reason (e.g. `chat not found`, `Unauthorized`, `bot was blocked by the
user`). Always check `ok` before reporting success. See the `endpoints` aspect for exact params and
the `auth` aspect for the BYO-token model.
