# chat/ — lmthing.chat

Thin SSO bootstrap shell. After login it wakes the user's pod and full-routes the browser to the
pod's own served web UI via a `?access_token=` query param.

## Stack

- React 19 + Vite 8 + TanStack Router + Tailwind CSS v4
- `@lmthing/auth` (SSO client), `@lmthing/ui`
- Uses `vite-plus` CLI wrapper

## Running Locally

```bash
cd chat && pnpm dev    # http://localhost:3001 / chat.test
```

## Route Structure

```
src/routes/
├── __root.tsx                  # AuthProvider("chat"), AuthGate, PinGate, RepoSyncGate
├── index.tsx                   # SSO bootstrap — ensures pod, then redirects to pod UI
├── conversation/
│   └── $conversationId.tsx     # Conversation view (stub)
└── settings.tsx                # Settings (stub)
```

## Architecture — Full-Route to Pod

`lmthing.chat` is a **static bootstrap shell** served at tokenless `lmthing.chat/`. It handles
authentication and then hands the browser entirely to the pod's served web UI.

```
Browser (no token)
  │
  │  GET lmthing.chat/          ← Envoy Rule C: no access_token → static chat SPA
  ▼
chat SPA (this app)
  │  1. @lmthing/auth SSO flow  → JWT in localStorage
  │  2. POST cloud/api/compute/ensure (Bearer JWT) → pod woken
  │  3. window.location.replace('/?access_token=<JWT>')
  ▼
Envoy Rule A: access_token present → dynamic-user-backend (the pod)
  │
  ▼
Pod's served web UI (`lmthing serve`)
  │  reads access_token from query, strips it from address bar via replaceState
  │  attaches Authorization: Bearer on all /api/* fetches
  │  attaches &access_token= on /api/ws
  ▼
Pod multi-session server (/api/sessions, /api/ws, etc.)
```

### Redirect Contract

- **Trigger**: authenticated session present AND `access_token` not already in `location.search`.
- **Action**: `POST {VITE_CLOUD_URL}/api/compute/ensure` (Bearer), then
  `window.location.replace('/?access_token=' + encodeURIComponent(session.accessToken))`.
- **Loop guard**: if `location.search` already contains `access_token` the bootstrap does nothing
  (that URL is being served by the pod, not the SPA — the `if` exits immediately).
- **Refresh**: a manual refresh of bare `/` re-hits the bootstrap, which immediately re-redirects
  with the stored session token — seamless.

### Environment Variables

| Variable | Default (dev) | Default (prod) | Purpose |
|----------|--------------|---------------|---------|
| `VITE_CLOUD_URL` | `https://cloud.test` | `https://cloud.lmthing.cloud` | Gateway origin (compute/ensure) |
