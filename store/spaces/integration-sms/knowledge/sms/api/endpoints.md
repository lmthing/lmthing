# Methods used by the wrappers

Base URL (pinned by the pod): `https://api.twilio.com/2010-04-01/Accounts/<TWILIO_ACCOUNT_SID>`. All
paths below are the RELATIVE `path` (a leading-slash resource) you pass to
`callConnection('sms', { method, path, headers?, body? })`. **Writes are FORM-encoded**: build the
body as a hand-rolled `application/x-www-form-urlencoded` string (`Key=` + `encodeURIComponent(value)`
joined by `&`) and set `Content-Type: application/x-www-form-urlencoded`. Responses are JSON.

### Send an SMS — `smsSend(to, body, from)`
- `POST /Messages.json`
- Form params: `To` (recipient, E.164), `From` (one of YOUR Twilio numbers, E.164), `Body` (text).
- Returns the message resource `{ sid, status, to, from, body, num_segments, price, date_created,
  ... }` on success, or `{ code, message, more_info, status }` on failure.
- `sid` starts with `SM…`. `status` progresses `queued` → `sent` → `delivered` (or `failed` /
  `undelivered`). The initial POST usually returns `queued`/`sending`.

### Send an MMS — `smsSendMms(to, body, mediaUrl, from)`
- `POST /Messages.json` (same resource, with media)
- Form params: `To`, `From`, `Body` (may be empty), and `MediaUrl` — a PUBLIC https URL Twilio fetches
  and attaches. `sid` starts with `MM…`.
- MMS is fully supported for US/Canada numbers; in many other regions Twilio delivers it as an SMS
  containing a link to the media.

### List messages — `smsListMessages()`
- `GET /Messages.json`
- Returns `{ messages: [{ sid, from, to, body, status, direction, num_media, date_sent, ... }],
  ... }` — recent inbound and outbound messages, newest first. Use it to review history or check the
  delivery `status` of a message you sent.

## Common error `code`s
- `20003` — authentication failed (bad `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`).
- `21211` — invalid `To` phone number (not valid E.164).
- `21606` / `21659` — the `From` isn't a Twilio number you own / isn't SMS-capable for that
  destination.
- `21608` — trial account: you may only send to numbers you've verified in the Console.
- `21610` — the recipient replied STOP and is unsubscribed.

## Inbound webhook payload (what the `handler` agent receives)
Twilio POSTs an `application/x-www-form-urlencoded` body when someone texts your number. Key fields:
`MessageSid`, `From` (the sender — reply here), `To` (your Twilio number — reply *from* here), `Body`,
`NumMedia`, and `MediaUrl0…` when media is attached. Status callbacks (delivery receipts) carry a
`MessageStatus`/`SmsStatus` instead and should be ignored.
