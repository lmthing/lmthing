# Methods used by the wrappers

Base URL (pinned by the pod): `https://api.telegram.org/bot<token>` — the bot token is already in the
base. All paths below are the RELATIVE `path` (a leading-slash method name) you pass to
`callConnection('telegram', { method, path, query?, body? })`. Every response is a JSON envelope:
`{ ok: boolean, result?, description?, error_code? }` — check `ok` first; on failure read `description`.

`chat_id` is a numeric id: a positive integer for a private chat, a negative integer for a group or
channel. Get it from an inbound update's `message.chat.id`, or from the user. Telegram does not
resolve @usernames for ordinary private chats.

### Send a message — `telegramSendMessage(chatId, text, replyToMessageId?)`
- `POST /sendMessage`
- Body: `{ chat_id, text, reply_to_message_id? }`. Include `reply_to_message_id` to thread the reply
  under a specific message.
- Returns `{ ok, result: <Message> }` on success (`result.message_id`, `result.chat`, `result.date`,
  `result.text`), or `{ ok: false, description }`.

### Send a photo — `telegramSendPhoto(chatId, photoUrl, caption?)`
- `POST /sendPhoto`
- Body: `{ chat_id, photo, caption? }`. `photo` is a public HTTP(S) URL Telegram fetches, or a
  `file_id`.
- Returns `{ ok, result: <Message> }` (the message contains a `photo` array of sizes).

### Send a document — `telegramSendDocument(chatId, documentUrl, caption?)`
- `POST /sendDocument`
- Body: `{ chat_id, document, caption? }`. `document` is a public HTTP(S) URL or a `file_id`.
- Returns `{ ok, result: <Message> }` (the message contains a `document` object).

### Show a chat action — `telegramSendChatAction(chatId, action)`
- `POST /sendChatAction`
- Body: `{ chat_id, action }`. Common `action` values: `typing`, `upload_photo`, `upload_document`.
  The status shows for ~5 seconds or until the next message.
- Returns `{ ok, result: true }`.

### Edit a message — `telegramEditMessageText(chatId, messageId, text)`
- `POST /editMessageText`
- Body: `{ chat_id, message_id, text }`. Only messages the bot itself sent can be edited.
- Returns `{ ok, result: <Message> }` on success (or `result: true` for some cases), or
  `{ ok: false, description }` (e.g. `message is not modified`).

### Delete a message — `telegramDeleteMessage(chatId, messageId)`
- `POST /deleteMessage`
- Body: `{ chat_id, message_id }`. The bot can delete its own messages; deleting others' messages
  requires admin rights in the group.
- Returns `{ ok, result: true }`.

### Get the bot — `telegramGetMe()`
- `GET /getMe`
- No params. Validates the token and returns the bot's identity.
- Returns `{ ok, result: { id, is_bot, first_name, username, ... } }`.

## Inbound update shape (for the handler)

Telegram delivers each webhook as an [Update](https://core.telegram.org/bots/api#update) object.
The message lives under the first present of `message`, `edited_message`, or `channel_post`. Within
that message the handler reads:

- `chat.id` — the chat to reply in.
- `message_id` — pass as `reply_to_message_id` to thread the reply.
- `text` — the user's text; if absent (sticker, service message, media without caption), ignore the
  update.

Updates with none of those message keys (e.g. `callback_query`) are not user messages — ignore them.
