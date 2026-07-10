# Auth (bring-your-own token)

lmthing does **not** broker OAuth for Synology Chat. The user creates the webhooks on their own
Synology NAS (Chat → Integration) and pastes the values into **the project's Settings → Integrations**,
which stores them as private pod environment variables:

- `SYNOLOGY_CHAT_BASE_URL` — the NAS origin, e.g. `https://nas.example.com:5001` (the part of the
  incoming-webhook URL before `/webapi/...`).
- `SYNOLOGY_CHAT_TOKEN` — the **incoming** webhook token (the `token=` value in the incoming-webhook
  URL). Used to authenticate outbound sends.
- `SYNOLOGY_CHAT_OUTGOING_TOKEN` — the **outgoing** webhook token, used pod-side to verify that inbound
  events genuinely came from the user's NAS.

On every `callConnection('synology', ...)` the pod:

1. Host-pins to `SYNOLOGY_CHAT_BASE_URL` and forwards the relative `path` + `query`.
2. Appends `?token=<SYNOLOGY_CHAT_TOKEN>` (the declared `query-token` auth style) to authenticate.
3. Returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP response; **Synology's own success
   flag is `data.success`** (a 200 with `data.success === false` is an application-level error, e.g.
   an `error.code` of `401`/`403` for a wrong or rotated incoming-webhook token).

Inbound (outgoing-webhook) events are verified pod-side using `SYNOLOGY_CHAT_OUTGOING_TOKEN`: the pod
checks the `token` field in the form body against that secret before delivering the event to the
`handler` agent — the agent never has to verify it.

If the token or base URL is missing, `callConnection` throws ("not configured — set
SYNOLOGY_CHAT_TOKEN …"). In that case, ask the user to fill in their Synology Chat details in **the
project's Settings → Integrations** — do not attempt to authenticate yourself and do not fabricate a
result.

## Note on self-signed NAS certificates

Many Synology NAS boxes serve HTTPS with a self-signed certificate. If sends fail with a TLS/certificate
error, the user should either install a trusted certificate on the NAS or use a hostname the
certificate actually covers in `SYNOLOGY_CHAT_BASE_URL`.
