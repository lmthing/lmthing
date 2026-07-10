# Operations used by the wrappers

Base URL (pinned by the pod): `https://graph.facebook.com/v20.0/<WHATSAPP_PHONE_ID>`. All wrappers
POST to the RELATIVE path `/messages` and pass a JSON `body`. Recipient numbers (`to`) are in
international format WITHOUT a leading `+` (e.g. `15551234567`).

Success response for a send: `{ messaging_product: "whatsapp", contacts: [{ input, wa_id }],
messages: [{ id }] }`. Failure response (any operation): `{ error: { message, type, code,
error_subcode?, fbtrace_id } }`.

### Send text — `whatsappSendText(to, body)`
- `POST /messages`
- Body: `{ messaging_product: "whatsapp", to, type: "text", text: { body } }`
- Deliverable only inside the 24-hour customer-service window.

### Reply to a message (quoted) — `whatsappReplyText(to, body, contextMessageId)`
- `POST /messages`
- Body: `{ messaging_product: "whatsapp", to, type: "text", text: { body },
  context: { message_id: contextMessageId } }`
- `contextMessageId` is the inbound message's `id` (a `wamid...`). The reply is shown quoting it.

### Send template — `whatsappSendTemplate(to, templateName, languageCode, components)`
- `POST /messages`
- Body: `{ messaging_product: "whatsapp", to, type: "template",
  template: { name: templateName, language: { code: languageCode }, components? } }`
- The ONLY way to message a user outside the 24-hour window. The template must be approved in the
  WhatsApp Manager; `components` supplies header/body/button variable values (omit for static ones).

### Send image by link — `whatsappSendImage(to, imageLink, caption)`
- `POST /messages`
- Body: `{ messaging_product: "whatsapp", to, type: "image", image: { link: imageLink, caption? } }`
- Meta fetches the image from the public HTTPS `link`; you do not upload bytes. Inside-window only.

### Mark read — `whatsappMarkRead(messageId)`
- `POST /messages`
- Body: `{ messaging_product: "whatsapp", status: "read", message_id: messageId }`
- Turns on blue read ticks for the inbound message. Response: `{ success: true }`.

## Inbound webhook payload (what the handler parses)

Meta POSTs `{ object: "whatsapp_business_account", entry: [{ id, changes: [{ field: "messages",
value }] }] }`. Inside `value`:

- `value.messages[0]` — present for an actual inbound message. Fields: `from` (sender number, the
  reply target), `id` (`wamid...`), `type`, and for text `text.body`.
- `value.contacts[0].profile.name` — the sender's display name (optional).
- `value.metadata.phone_number_id` — your own number's id.
- `value.statuses[...]` — present INSTEAD of `messages` for delivery/read receipts. Ignore these —
  they are not inbound messages and must not be replied to.

## Common error codes

- `190` — access token expired or invalid → regenerate `WHATSAPP_TOKEN`.
- `131047` — message failed because it's outside the 24-hour window → use an approved template.
- `100` — invalid parameter (e.g. malformed `to` number or missing field).
- `131030` — recipient number not in the allowed list (test numbers only, before the number is live).
