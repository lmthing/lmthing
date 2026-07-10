---
variable: synologyApi
description: The Synology Chat External API surface reached via callConnection('synology', ...) — the incoming-webhook endpoint on the user's NAS, the payload shapes the wrapper functions send, the { success } envelope, and the BYO-token auth model.
---

# Synology Chat External API cheat-sheet

The agent talks to the user's own Synology NAS through `callConnection('synology', req)`. The pod pins
the base URL to the user's **`INTEGRATION_SYNOLOGY_CHAT_BASE_URL`** (e.g. `https://nas.example.com:5001`) and
appends `?token=<INTEGRATION_SYNOLOGY_CHAT_TOKEN>` (the incoming-webhook token) automatically — the agent passes
only a RELATIVE `path` and never handles credentials.

Synology Chat's bot surface is intentionally small. There is **one outbound endpoint** — the
**incoming webhook** — reached at:

```
POST /webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2
Content-Type: application/x-www-form-urlencoded
body: payload=<url-encoded JSON>
```

The JSON in `payload=` selects what to send:

- `{ "text": "..." }` — post to the webhook's channel (`synologySendMessage`).
- `{ "text": "...", "user_ids": [id] }` — DM specific user(s) (`synologySendToUser`).
- `{ "text": "...", "file_url": "..." }` — post text plus a file the NAS fetches (`synologySendFile`).

There is **no** list/read/search API — an incoming webhook can only push into the single channel that
owns its token. Inbound messages arrive separately via the NAS's **outgoing webhook** (handled by the
`handler` agent, which parses the raw form body).

Every incoming-webhook call returns `{ "success": boolean }`, plus an `error` object (with a numeric
`code`) when `success` is `false`. Always check `success` before reporting delivery. See the
`endpoints` aspect for exact payloads and the `auth` aspect for the BYO-token model.
