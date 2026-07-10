---
variable: whatsappApi
description: The WhatsApp Cloud API (Meta Graph) surface reached via callConnection('whatsapp', ...) — base URL, the /messages operations the wrapper functions use, their message shapes, the success/error response, the 24-hour window rule, and the BYO-token auth model.
---

# WhatsApp Cloud API cheat-sheet

The agent talks to the **WhatsApp Cloud API** (Meta Graph API) through `callConnection('whatsapp',
req)`. The pod pins the base URL to **`https://graph.facebook.com/v20.0/<WHATSAPP_PHONE_ID>`** — the
business phone number's node — and attaches the user's own `WHATSAPP_TOKEN` as a bearer token. The
agent passes only a RELATIVE `path` (the base already includes the phone-number id, so it is just
`/messages`) and never handles credentials or the phone number id.

This is the official **Cloud API** (hosted by Meta), not an unofficial library such as Baileys.

Every outbound operation is a `POST /messages` with a JSON body whose `type` selects the message
kind:

- **text** — `whatsappSendText(to, body)`.
- **text with `context`** — `whatsappReplyText(to, body, contextMessageId)` (quotes an inbound msg).
- **template** — `whatsappSendTemplate(to, name, languageCode, components)`.
- **image (by link)** — `whatsappSendImage(to, imageLink, caption)`.
- **read receipt** — `whatsappMarkRead(messageId)` (`status: 'read'`, no content).

On success the API returns `{ messaging_product, contacts, messages: [{ id }] }` (the
`messages[0].id` is the sent message's `wamid`). On failure it returns `{ error: { message, code,
error_subcode?, ... } }`. Always check for `error` before reporting success.

**24-hour window:** free-form messages (text/image) can only be delivered to a user within 24 hours
of that user's last inbound message. To start or re-open a conversation, use an approved **template**
(`whatsappSendTemplate`).

See the `endpoints` aspect for exact body shapes and the `auth` aspect for the BYO-token model.
