# Auth (BYO token — handled by the pod)

lmthing does **not** broker OAuth for Mattermost. The user creates their OWN bot account (or a
personal access token) on their Mattermost server and pastes the token — plus their server URL —
into **the project's Settings → Integrations**, which stores them as pod environment variables:

- `INTEGRATION_MATTERMOST_BASE_URL` — the user's Mattermost server, e.g. `https://mattermost.example.com`
  (no trailing `/api/v4`; the pod appends it).
- `INTEGRATION_MATTERMOST_TOKEN` — the bot access token or personal access token.
- `INTEGRATION_MATTERMOST_OUTGOING_TOKEN` — the token from the user's Mattermost **outgoing webhook**, used
  only to verify inbound events (never sent by the agent).

On every `callConnection('mattermost', ...)` the pod:

1. Reads `INTEGRATION_MATTERMOST_TOKEN` from the pod env (per the space's `connection` descriptor).
2. Attaches it as `Authorization: Bearer <token>`.
3. Pins the host to `<INTEGRATION_MATTERMOST_BASE_URL>/api/v4` and forwards your relative `path` + `query`/`body`.
4. Returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP response; **Mattermost's payload
   is `data`**: the requested object on success, or `{ id, message, status_code }` on an
   application error (e.g. `401` invalid/expired token, `403` the bot is not a member of the
   channel, `404` not found).

If the token or server URL is missing, `callConnection` throws ("not configured — set
INTEGRATION_MATTERMOST_TOKEN …"). In that case, ask the user to add their Mattermost server URL and token in
**the project's Settings → Integrations** — do not attempt to authenticate yourself and do not
fabricate a result.

Inbound events are verified pod-side: Mattermost's outgoing webhook includes a `token` form field,
and the pod compares it to `INTEGRATION_MATTERMOST_OUTGOING_TOKEN` (the space's `webhook` descriptor) before
delivering the event to the handler agent.
