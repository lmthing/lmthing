# Auth (bring-your-own token)

lmthing does **not** broker LINE OAuth. The user creates their own LINE Official Account +
Messaging API channel in the [LINE Developers Console](https://developers.line.biz/console/), issues
a **channel access token**, copies their **channel secret**, and pastes both into **the project's
Settings → Integrations**. Those become pod environment variables:

- `INTEGRATION_LINE_CHANNEL_ACCESS_TOKEN` — the Bearer token for outbound calls.
- `INTEGRATION_LINE_CHANNEL_SECRET` — used pod-side to verify inbound webhook signatures.

The agent never sees, stores, or refreshes these. On every `callConnection('line', …)` the pod:

1. Reads `INTEGRATION_LINE_CHANNEL_ACCESS_TOKEN` from the pod env.
2. Attaches it as `Authorization: Bearer <token>`.
3. Pins the host to `https://api.line.me` and forwards your relative `path` + `query`/`body`.
4. Returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP response; **LINE's own body is in
   `data`** (an empty `{}` on success, or `{ message, details }` on an application error such as
   `Invalid reply token` or `Authorization failed`).

Inbound events are verified pod-side: LINE signs each webhook request with the channel secret and
sends the signature in the **`x-line-signature`** header (HMAC-SHA256 of the raw body, base64). The
pod recomputes it from `INTEGRATION_LINE_CHANNEL_SECRET` and rejects mismatches — a wrong channel secret shows
up as a 401 on LINE's "Verify" button. The user just points LINE's webhook URL at their lmthing
inbound URL; no code is involved.

If the token is missing, `callConnection` throws ("not configured — set INTEGRATION_LINE_CHANNEL_ACCESS_TOKEN in
Settings → Integrations"); if the token is wrong/expired the call returns `data` with
`message: "Authorization failed"`. In either case, ask the user to (re)add their token in **the
project's Settings → Integrations** — do not try to authenticate yourself or fabricate a result.
