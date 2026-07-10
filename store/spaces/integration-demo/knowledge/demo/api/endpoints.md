# Demo endpoints

Base URL is your `INTEGRATION_DEMO_BASE_URL` (host-pinned by the pod). Paths below are relative.

## POST /messages — send a message (`demoSendMessage`)

Body (JSON):

| field | type | notes |
|---|---|---|
| `chat_id` | string | the chat/conversation id to send to |
| `text` | string | the message text |

Returns whatever your endpoint responds with (echo services typically return `200` with an echo of
the request). The pod surfaces it as `{ ok, status, data }`.

## GET /health — health check (`demoGetHealth`)

No body. Returns whatever your endpoint responds with for `/health`.

## Inbound webhook payload

The demo endpoint (or a test harness) POSTs a signed JSON body to the lmthing inbound URL:

```json
{ "message": { "chat": { "id": "c1" }, "text": "hello there" } }
```

Signed with `x-demo-signature: sha256=<hex HMAC-SHA256(INTEGRATION_DEMO_WEBHOOK_SECRET, rawBody)>`. The pod
verifies the signature, derives the thread key from `message.chat.id`, and delivers the raw payload
to the Demo Channel agent, which replies via `demoSendMessage(message.chat.id, answer)`.
