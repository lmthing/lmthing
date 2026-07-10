# Auth (handled by the gateway)

The agent never sees, stores, or refreshes Google OAuth tokens. When the user connects Google in
**Studio → Connections**, the gateway stores the OAuth grant. On every `callConnection('google',
...)` the gateway:

1. Resolves the calling user's stored Google connection.
2. Attaches a valid access token (refreshing it if expired) as the `Authorization: Bearer ...`
   header.
3. Pins the host to `https://www.googleapis.com` and forwards your relative `path` + `query`/`body`.
4. Returns `{ ok, status, data }` — `ok` reflects a 2xx from Google; `data` is the parsed body.

Relevant OAuth scopes (granted at connect time, not by the agent): Gmail read + send
(`gmail.readonly`, `gmail.send`) and Calendar read + write (`calendar.events`). If the connection
is missing or a scope was not granted, `callConnection` throws ("not connected" / "no connections
gateway") or returns `ok: false`. In that case, ask the user to (re)connect Google in
**Studio → Connections** — do not attempt to authenticate yourself and do not fabricate a result.
