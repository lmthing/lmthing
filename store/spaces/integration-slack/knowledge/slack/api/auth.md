# Auth (handled by the gateway)

The agent never sees, stores, or refreshes Slack OAuth tokens. When the user connects Slack in
**Studio → Connections**, the gateway stores the OAuth grant. On every `callConnection('slack',
...)` the gateway:

1. Resolves the calling user's stored Slack connection.
2. Attaches the OAuth token as the `Authorization: Bearer ...` header.
3. Pins the host to `https://slack.com/api` and forwards your relative `path` + `query`/`body`.
4. Returns `{ ok, status, data }` — `status`/`ok` reflect the HTTP response; **Slack's own success
   flag is `data.ok`** (a 200 with `data.ok === false` is an application-level error such as
   `channel_not_found` or `invalid_auth`).

Relevant OAuth scopes (granted at connect time, not by the agent): typically `chat:write`,
`channels:read` / `groups:read`, and `search:read`. If the connection is missing or a scope was not
granted, `callConnection` throws ("not connected" / "no connections gateway"), or the call returns
`data.ok === false` with an error like `missing_scope`. In that case, ask the user to (re)connect
Slack in **Studio → Connections** — do not attempt to authenticate yourself and do not fabricate a
result.
