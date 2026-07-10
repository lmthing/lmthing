# Endpoints used by the wrappers

Base URL (pinned by the pod): the user's `SYNOLOGY_CHAT_BASE_URL`, e.g. `https://nas.example.com:5001`.
There is a single outbound endpoint — the **incoming webhook** — and all three wrapper functions POST
to it, differing only by the JSON they place in the `payload=` form field.

```
POST /webapi/entry.cgi
query: { api: 'SYNO.Chat.External', method: 'incoming', version: '2' }
headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
body: 'payload=' + encodeURIComponent(JSON.stringify(payloadObject))
```

The pod appends `?token=<SYNOLOGY_CHAT_TOKEN>` to the query automatically. `Buffer` and
`URLSearchParams` are NOT available in the sandbox, so the body string is built by hand with
`encodeURIComponent`. Every call returns `{ success: boolean, error?: { code, errors? } }`.

### Send a message — `synologySendMessage(text)`
- Payload: `{ text }`.
- Posts into the single channel that owns the incoming-webhook token.
- Returns `{ success: true }`, or `{ success: false, error: { code } }`.

### Direct message a user — `synologySendToUser(userId, text)`
- Payload: `{ text, user_ids: [userId] }`.
- Delivers the message privately to the given Synology Chat user id(s). Used by the inbound `handler`
  agent to reply to whoever messaged the bot (`user_id` from the outgoing-webhook body).
- Returns `{ success: true }`, or `{ success: false, error: { code } }`.

### Send a file — `synologySendFile(text, fileUrl)`
- Payload: `{ text, file_url: fileUrl }`.
- The NAS fetches the file from `fileUrl` (which must be reachable from the NAS) and attaches it.
- Returns `{ success: true }`, or `{ success: false, error: { code } }`.

## Inbound (outgoing webhook) — for the handler agent

The NAS's **outgoing webhook** POSTs a form-encoded body when a user messages the bot. Fields:
`token`, `channel_id`, `channel_name`, `user_id`, `username`, `post_id`, `text`, `timestamp`. The pod
verifies `token` against `SYNOLOGY_CHAT_OUTGOING_TOKEN`, then delivers the raw body to the `handler`
agent, which reads `user_id` (reply target) and `text` (the request), and replies via
`synologySendToUser(user_id, answer)`. There is no channel-reply or threading API — replies are DMs.
