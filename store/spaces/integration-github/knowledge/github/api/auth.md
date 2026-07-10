# Auth (handled by the gateway)

The agent never sees, stores, or refreshes GitHub OAuth tokens. When the user connects GitHub in
**Studio → Connections**, the gateway stores the OAuth grant. On every `callConnection('github',
...)` the gateway:

1. Resolves the calling user's stored GitHub connection.
2. Attaches the OAuth token as the `Authorization: Bearer ...` header.
3. Pins the host to `https://api.github.com` and forwards your relative `path` + `query`/`body` and
   the `Accept: application/vnd.github+json` header you pass in `req.headers`.
4. Returns `{ ok, status, data }` — `ok` reflects a 2xx from GitHub; `data` is the parsed body (an
   error body carries `message` and, for 422s, `errors`).

Relevant OAuth scopes (granted at connect time, not by the agent): typically `repo` (issues, PRs,
and code search across private repos) or narrower read scopes for public-only access. If the
connection is missing or a scope was not granted, `callConnection` throws ("not connected" / "no
connections gateway") or returns `ok: false` (403/404). In that case, ask the user to (re)connect
GitHub in **Studio → Connections** — do not attempt to authenticate yourself and do not fabricate a
result.
