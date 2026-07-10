# Demo (Echo) integration

A **self-contained demo** for trying lmthing's integration engine end-to-end — no real provider
account needed. It sends messages to an echo endpoint you control (e.g. a free
[webhook.site](https://webhook.site) URL) and receives signed webhooks back.

Use it to see how an integration space works: an outbound `callConnection('demo', …)` and an inbound
signed webhook handled by an agent that replies in the same chat.

## What goes where

Configure these in the project's **Settings → Integrations** after installing:

| Field | What it is | Where to get it |
|---|---|---|
| `DEMO_BASE_URL` | Your echo endpoint's base URL | Open [webhook.site](https://webhook.site), copy "Your unique URL" (e.g. `https://webhook.site/abc-123`). Any HTTP endpoint you control works. |
| `DEMO_API_TOKEN` | A token sent as `Authorization: Bearer …` on outbound sends | Make one up (any string). It just proves the Bearer header is attached. |
| `DEMO_WEBHOOK_SECRET` | The HMAC-SHA256 secret used to verify inbound webhooks | Make one up (any random string). Sign your test webhooks with it. |

## Try it — outbound

Ask THING (or the Demo agent): *"send a demo message to chat c1 saying hello"*. The agent calls
`demoSendMessage('c1', 'hello')`, which POSTs `{ "chat_id": "c1", "text": "hello" }` to
`DEMO_BASE_URL/messages` with your Bearer token. Watch it arrive on your webhook.site page.

## Try it — inbound

Send a **signed** webhook to your lmthing inbound URL (shown in Settings → Integrations, ending in
`/demo`). Sign the raw body with HMAC-SHA256 using `DEMO_WEBHOOK_SECRET`:

```bash
BODY='{"message":{"chat":{"id":"c1"},"text":"hello there"}}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$DEMO_WEBHOOK_SECRET" | awk '{print $2}')"
curl -X POST "<your inbound URL ending in /demo>" \
  -H "content-type: application/json" \
  -H "x-demo-signature: $SIG" \
  -d "$BODY"
```

The pod verifies the signature, wakes the Demo Channel agent with the raw payload, and the agent
replies by calling `demoSendMessage('c1', <answer>)` — which lands back on your echo endpoint.

## Troubleshooting

- **401 signature verification failed** — the `x-demo-signature` doesn't match. Re-check you signed the
  EXACT raw body with the same `DEMO_WEBHOOK_SECRET`.
- **"not configured — set DEMO_API_TOKEN …"** — set all three fields in Settings → Integrations.
- **Nothing arrives on webhook.site** — check `DEMO_BASE_URL` is correct and reachable from the pod.
