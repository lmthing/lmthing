---
variable: smsApi
description: The Twilio Programmable Messaging REST API surface reached via callConnection('sms', ...) — base URL, the FORM-encoded methods the wrapper functions use, their parameters, the success/error response shapes, and the pod-managed BYO-credential auth model.
---

# Twilio Messaging API cheat-sheet

The agent sends and reads texts through `callConnection('sms', req)`. The pod pins the base URL to
**`https://api.twilio.com/2010-04-01/Accounts/<INTEGRATION_SMS_ACCOUNT_SID>`** and authenticates with the
user's own `INTEGRATION_SMS_ACCOUNT_SID` + `INTEGRATION_SMS_AUTH_TOKEN` (HTTP Basic). The agent passes only a RELATIVE
`path` (a leading-slash resource like `/Messages.json`) and never handles credentials.

**Twilio is FORM-encoded, not JSON.** For writes (`POST`), send the body as an
`application/x-www-form-urlencoded` string that you build by hand — there is no `URLSearchParams` or
`Buffer` in the sandbox, so concatenate `Key=` + `encodeURIComponent(value)` pairs joined by `&`, and
set the `Content-Type: application/x-www-form-urlencoded` header. Responses come back as JSON.

Wrapped methods:

- **`POST /Messages.json`** — send an SMS (`smsSend`) or an MMS with a `MediaUrl` (`smsSendMms`).
- **`GET /Messages.json`** — list recent inbound + outbound messages (`smsListMessages`).

On **success** a message resource carries a `sid` (`SM…` for SMS, `MM…` for MMS) and a delivery
`status` (`queued` → `sent` → `delivered`, or `failed`/`undelivered`). On **failure** Twilio returns
an error object with a numeric **`code`**, a human `message`, and `more_info` — always read `code`
before reporting success. See the `endpoints` aspect for exact params/shapes and the `auth` aspect for
the BYO-credential model.
