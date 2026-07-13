# @lmthing/auth — client auth library

The shared client-side auth library for cross-domain SSO across all `lmthing.*` SPAs (`sdk/org/libs/auth/package.json:2-4`). It owns the **browser session** — where the gateway JWT lives, how it is refreshed, and the React surface (`AuthProvider` + `useAuth`) that every app wraps itself in. It never talks to Zitadel; it only calls the gateway's SSO/refresh endpoints. The server side of these flows — token issuance, SSO code minting — is documented in [../cloud/auth.md](../cloud/auth.md).

The package is a source-only workspace lib: `main`/`exports` point at `./src/index.ts`, `react` (`^18 || ^19`) is a peer dependency, and it is `sideEffects: false` (`sdk/org/libs/auth/package.json:5-18`). Public surface (`sdk/org/libs/auth/src/index.ts`):

- `AuthProvider`, `useAuth` — the React context.
- Client primitives: `redirectToLogin`, `handleAuthCallback`, `refreshSession`, `ensureValidToken`, `authFetch`, `isSessionExpired`, `getAuthHeaders`, `clearSession`, `onSessionChange`, `getSession`, `isPinSet`, `verifyPin`, `derivePinKey`, `hashPin`, `getPodInjectedToken`, `isPodEmbedded`, `isLocalRun`.
- `useRepoSync` hook.
- Types: `AuthSession`, `AuthConfig`, `AuthContextValue`, `RepoSyncState`, `RepoSyncOptions`.

## Session model

A session is the `AuthSession` shape (`sdk/org/libs/auth/src/types.ts:1-9`):

```ts
interface AuthSession {
  accessToken: string
  refreshToken?: string
  expiresAt?: number          // unix seconds
  userId: string
  email: string
  githubRepo: string | null
  githubUsername: string | null
}
```

It is persisted as JSON in `localStorage` under the **single constant key** `lmthing_session` (`sdk/org/libs/auth/src/client.ts:3`). Because the key is constant and not namespaced per app, a single logical session is shared across every surface that mounts an `AuthProvider` — the unified web app deliberately mounts one `AuthProvider appName="studio"` at the root so studio/computer/chat all read the same stored session (`sdk/org/apps/web/src/routes/__root.tsx:12-17`).

Accessors:

- `getSession()` reads + `JSON.parse`s the key, returning `null` on absence or parse error (`sdk/org/libs/auth/src/client.ts:218-227`).
- `storeSession(session)` writes the key and fires listeners (`client.ts:259-262`).
- `clearSession()` removes the key and fires listeners with `null` (`client.ts:254-257`).
- `getAuthHeaders()` returns `{ Authorization: 'Bearer <accessToken>' }` straight from storage, or `{}` (`client.ts:206-216`).

### Out-of-band change pub/sub

A module-level `Set` of listeners keeps React state in sync when the session is rotated **outside** React — e.g. `authFetch`'s 401-retry writes to `localStorage` directly. `onSessionChange(cb)` subscribes and returns an unsubscribe; `emitSessionChange` is called by every writer (`storeSession`, `clearSession`, `refreshSession`, `handleAuthCallback`) (`sdk/org/libs/auth/src/client.ts:10-21`, `88-89`, `113-114`). `AuthProvider` subscribes to this so its `session` state never goes stale (`sdk/org/apps/web/... AuthProvider.tsx:120-123`, i.e. `sdk/org/libs/auth/src/AuthProvider.tsx:120-123`).

## SSO login flow (client side)

The library implements the **app side** of the cross-domain SSO exchange (gateway side: [../cloud/auth.md](../cloud/auth.md)):

1. **`redirectToLogin(config)`** — generates a random 16-byte hex `state`, stashes it in `sessionStorage` under `sso_state`, and navigates to `${comUrl}/auth/sso?redirect_uri=<origin+callbackPath>&app=<appName>&state=<state>` (`sdk/org/libs/auth/src/client.ts:23-41`). `generateState` uses `crypto.getRandomValues` (`client.ts:23-27`).

2. **`handleAuthCallback(config)`** — runs on return. Reads `?code` and `?state` from the URL; returns `null` if there's no `code` (`client.ts:43-48`). It **verifies `state` against the stashed `sso_state`** to block CSRF, throwing `Invalid state parameter — possible CSRF attack` on mismatch — but if `sso_state` is entirely absent it treats that as a React StrictMode double-invoke after a successful exchange already cleared it and returns the existing session (`client.ts:50-59`). It then `POST`s `{ code, redirect_uri }` to `${cloudUrl}/api/auth/sso/exchange`, clears `sso_state` only after success, maps the response into an `AuthSession`, stores it, and emits the change (`client.ts:61-91`). The mapping reads `access_token`, `refresh_token`, `expires_at`, and `user.{id,email,github_repo,github_username}` (`client.ts:77-89`).

`AuthProvider.login()` calls `redirectToLogin`, unless the app is embedded as an iframe (`window !== window.top`), in which case it posts `{type:'lmthing:auth-needed'}` to the parent instead of navigating (`sdk/org/libs/auth/src/AuthProvider.tsx:148-156`).

## Token refresh

Two constants govern timing:

- `REFRESH_BUFFER = 60` seconds — how far before real expiry a token is treated as expired (`sdk/org/libs/auth/src/client.ts:7-8`).
- In `AuthProvider`, a separate proactive `REFRESH_BUFFER = 5 * 60` seconds (`AuthProvider.tsx:130`).

Primitives:

- **`refreshSession(config)`** — no-op returning `null` if there's no `refreshToken`. Otherwise `POST`s `{ refresh_token }` to `${cloudUrl}/api/auth/refresh`; on non-OK returns `null`; on success merges `access_token`/`refresh_token`/`expires_at` into the existing session (keeping the old refresh token if the response omits one), stores it, and emits (`sdk/org/libs/auth/src/client.ts:93-116`).
- **`isSessionExpired(session, bufferSec = 60)`** — `false` if there's no `expiresAt` (i.e. non-expiring sessions like demo/pod never look expired); otherwise `now >= expiresAt - buffer` (`client.ts:118-122`).
- **`ensureValidToken(config)`** — the "give me a usable token now" path: throws `Not authenticated` with no session; returns the current token if not near expiry; otherwise refreshes, and on failure `clearSession()`s and throws `Session expired` (callers treat the throw as force-re-login) (`client.ts:124-145`).

### `authFetch` — the workhorse

`authFetch(config, url, options)` is the authenticated fetch used by SPAs (`sdk/org/libs/auth/src/client.ts:174-204`):

1. Calls `ensureValidToken` (proactive refresh) and sets `Authorization: Bearer <token>`.
2. On a **401**, force-`refreshSession` once and retry with the new token; if refresh fails, `clearSession()` (`client.ts:185-193`). This is what keeps long-lived tabs working after the 12h access token expires.
3. On a **"waking" 503** (the Envoy activator scaled the target pod to zero and returned `{waking:true}` after firing a wake), it transparently retries up to `WAKE_RETRIES = 6` times, `WAKE_RETRY_MS = 1200`ms apart. A no-endpoint 503 never reached the pod (zero side effects), so retrying even a POST is safe (`client.ts:155-201`). `isWakingResponse` clones the response and checks `data.waking === true` (`client.ts:161-169`).

It returns the raw `Response`; callers check `res.ok`.

## `AuthProvider` / `useAuth`

`AuthProvider({ appName, callbackPath = '/', children })` (`sdk/org/libs/auth/src/AuthProvider.tsx:35`) builds an `AuthConfig` via `resolveConfig` and provides `AuthContextValue`. `useAuth()` reads the context and throws if used outside a provider (`AuthProvider.tsx:226-230`).

### Config resolution

`resolveConfig(appName, callbackPath)` picks `comUrl`/`cloudUrl` from Vite env with dev/prod fallbacks (`sdk/org/libs/auth/src/AuthProvider.tsx:7-19`):

- `comUrl` = `VITE_COM_URL` || (dev ? `<protocol>//com.test` : `https://lmthing.com`).
- `cloudUrl` = `VITE_CLOUD_URL` || (dev ? `<protocol>//cloud.test` : `https://lmthing.cloud`).

`isDev` = `import.meta.env.DEV`; `protocol` mirrors the current page's (`AuthProvider.tsx:8-9`).

### Demo / local mode

`isDemo` is true when **either** `VITE_DEMO_USER === 'true'` (build-time) **or** `isLocalRun()` (`sdk/org/libs/auth/src/AuthProvider.tsx:39`). `isLocalRun()` returns true for `localhost`/`127.0.0.1`/`0.0.0.0`/`*.test` hostnames — where the pod serves the app itself and enforces no gateway auth — and false for production `lmthing.*` hosts (`sdk/org/libs/auth/src/client.ts:248-252`). In demo mode the provider starts with a hardcoded `DEMO_SESSION` (`accessToken:'demo'`, `userId:'demo-user'`, `email:'demo@lmthing.local'`), `isLoading:false`, and **all SSO/pin logic is skipped** — every effect and `login`/`logout` early-returns on `isDemo` (`AuthProvider.tsx:27-40`, `47`, `60`, `121`, `128`, `149`, `159`).

### Mount lifecycle (non-demo)

Three effects drive the session on mount (`sdk/org/libs/auth/src/AuthProvider.tsx:46-146`):

1. **Parent-frame session injection** — listens for `postMessage {type:'lmthing:session', session}` (e.g. lmthing.chat injecting into a lmthing.computer iframe), stores it, and clears loading (`AuthProvider.tsx:46-57`).
2. **Bootstrap** (`AuthProvider.tsx:59-114`):
   - If a pod-injected token exists (`getPodInjectedToken()`), build a `pod-user` session from it and finish (`AuthProvider.tsx:61-74`) — the embedded-pod case, which is **dead today**: nothing in the repo produces that token (see [Pod embedding](#pod-embedding-vestigial--no-producer-today)).
   - Else if the URL has `?code`, run `handleAuthCallback`, then strip `code`/`state` from the URL via `history.replaceState` and clear loading.
   - Else a cold reload: if the stored session is expired **and** has a refresh token, `refreshSession` **before** unblocking the UI (so the app's first requests don't fly out with a stale token and 401); otherwise just adopt the stored session.
3. **Out-of-band sync** — subscribe to `onSessionChange` (`AuthProvider.tsx:120-123`).

A fourth effect is the **proactive refresh timer**: when a session has both `refreshToken` and `expiresAt`, it schedules a `refreshSession` `5*60`s before expiry (immediately if already past), and force-logs-out if that refresh returns null (`AuthProvider.tsx:127-146`).

### Pod embedding (vestigial — no producer today)

`getPodInjectedToken()` reads `window.__LM_ACCESS_TOKEN__`, returning it or `null`; `isPodEmbedded()` is `getPodInjectedToken() !== null` (`sdk/org/libs/auth/src/client.ts:229-239`). When present, the provider skips SSO entirely and runs as `pod-user` with `email:''` (`AuthProvider.tsx:61-74`).

**Nothing in the repo ever sets that global.** The pod's static-app server serves the SPA's `index.html` byte-for-byte from disk — read once, cached, no bootstrap injection — and says so explicitly: *"The unified app self-authenticates via @lmthing/auth (token in localStorage) and computes its own WS URL, so its index.html is served verbatim — no bootstrap injection is needed"* (`sdk/org/libs/cli/src/server/static-apps.ts:32-34`; `getIndexHtml` just `readFile`s and caches the raw string, never rewriting it — `:75-88`). The shipped `index.html` contains only the wake-beacon script and the module entry — no token injection (`sdk/org/apps/web/index.html:6-39`, `55`). So in the current codebase `getPodInjectedToken()` always returns `null`, `isPodEmbedded()` is always `false`, and the `pod-user` branch of the bootstrap effect is dead code.

The case it was meant to cover — *the app being served by the user's own pod* — is instead handled by **`isLocalRun()`** (hostname-based), which is why the two are always used together: `PodEnsureGate` short-circuits on `isPodEmbedded() || isLocalRun()` (`sdk/org/apps/web/src/lib/gates.tsx:219`) and `isDemo` is `VITE_DEMO_USER || isLocalRun()` (`AuthProvider.tsx:39`). Today only the `isLocalRun()` half ever fires.

### `AuthContextValue`

The context exposes (`sdk/org/libs/auth/src/types.ts:18-41`, wired in `AuthProvider.tsx:196-220`):

| Member | Meaning |
|---|---|
| `session` | current `AuthSession` or `null` |
| `username` | `session.email` or `null` (`AuthProvider.tsx:196`) |
| `isAuthenticated` | `!!session` (`AuthProvider.tsx:197`) |
| `isLoading` | true until mount lifecycle resolves |
| `githubRepo` / `githubUsername` | from session, else `null` (`AuthProvider.tsx:199-200`) |
| `needsPin` | `!isDemo && isPinSet() && !pinUnlocked` (`AuthProvider.tsx:198`) |
| `pinUnlocked` | pin unlocked this session |
| `login()` | SSO redirect, or iframe `auth-needed` postMessage |
| `logout()` | clears session + pin state (`AuthProvider.tsx:158-164`) |
| `getAccessToken()` | `ensureValidToken` — refresh-if-near-expiry (`AuthProvider.tsx:179`) |
| `getAccessTokenSync()` | sync read of stored token, **no refresh** — for injecting into runtimes (e.g. `PodTransport`) that need a getter always returning the latest stored token; a captured React closure would go stale, reading `localStorage` does not (`AuthProvider.tsx:186-190`, `types.ts:31-34`) |
| `refreshAuth()` | force-rotate the token pair now (the transport's `refresh` companion to `getAccessTokenSync`) (`AuthProvider.tsx:192-194`) |
| `authFetch(url, opts)` | bound `authFetch` (`AuthProvider.tsx:181-184`) |
| `unlockPin(pin)` / `getPinKey()` | client-side PIN unlock (below) |

## Client-side PIN encryption

Optional per-device PIN gating for sensitive local data, using WebCrypto (`sdk/org/libs/auth/src/client.ts:264-315`). Keys in `localStorage`: `lmthing_pin_hash`, `lmthing_pin_set` (`client.ts:4-5`).

- `isPinSet()` — `lmthing_pin_set === 'true'` (`client.ts:266-268`).
- `hashPin(pin)` — SHA-256 hex of the PIN (`client.ts:274-280`); `getPinHash()` reads the stored hash (`client.ts:270-272`).
- `verifyPin(pin)` — compares `hashPin(pin)` to the stored hash (`client.ts:282-287`).
- `derivePinKey(pin, userId)` — PBKDF2 (100k iterations, SHA-256, salt `lmthing_<userId>`) → non-extractable AES-GCM-256 `CryptoKey` for encrypt/decrypt (`client.ts:289-315`).

`AuthProvider.unlockPin(pin)` verifies, and on success derives the key into a ref and sets `pinUnlocked` (`AuthProvider.tsx:166-173`); `getPinKey()` returns that in-memory key (never persisted) (`AuthProvider.tsx:175-177`). `logout()` drops both `pinUnlocked` and the key (`AuthProvider.tsx:158-164`). The PIN gate UI is `PinGate` in `@lmthing/ui`, mounted at the app root under `AuthGate` (`sdk/org/apps/web/src/routes/__root.tsx:3`, `18-21`).

## `useRepoSync`

A hook that fetches the user's GitHub repo files **once per session** on login (`sdk/org/libs/auth/src/useRepoSync.ts:20-125`). Given `{ session, isAuthenticated, githubToken, onFilesLoaded }`, it no-ops unless authenticated with a `session.githubRepo` and a `githubToken`, and guards re-runs with a `syncedRef` (`useRepoSync.ts:33-36`). It calls the GitHub REST API directly with `Authorization: token <githubToken>` (`useRepoSync.ts:47-51`):

- Resolves the default branch (treating a **404 as "repo doesn't exist yet"**, expected for new users) (`useRepoSync.ts:53-63`).
- Fetches the branch, then the recursive git tree (`useRepoSync.ts:64-78`).
- Filters blobs to `package.json`, `lmthing.json`, any `.env*` file, and anything under `agents/`, `flows/`, `knowledge/` (`useRepoSync.ts:80-90`).
- Fetches each blob and base64-decodes it as UTF-8 (`decodeBase64Utf8`, `useRepoSync.ts:92-103`, `127-132`), then calls `onFilesLoaded(files)`.

State is `RepoSyncState { isSyncing, lastSynced, error, fileCount }` (`useRepoSync.ts:4-9`).

### Where `githubToken` comes from — nowhere (the hook is inert)

The hook's only caller is `RepoSyncGate` on the computer surface, which sources the token as
`localStorage.getItem('github_token')` and whose `onFilesLoaded` is just a `console.log` of the file count
(`sdk/org/apps/web/src/routes/computer/route.tsx:11-27`, token read at `:13`). **No code in this repo ever
writes `github_token`** — a repo-wide search for `setItem(` turns up only `lmthing_session`, `sso_state`,
`lmthing_pin_hash`/`lmthing_pin_set`, the theme/sidebar/wake-beacon keys and the pending-install keys; none
is `github_token`. Since the effect bails on `!githubToken` (`useRepoSync.ts:34`), `useRepoSync` never
fetches anything in the shipped app — it is dead wiring kept behind an always-null token.

The only source the hook itself accepts is that caller-supplied `githubToken` — on `/computer` it is
`localStorage.getItem('github_token')` (`sdk/org/apps/web/src/routes/computer/route.tsx:13`), a key nothing
writes — so in practice the token is always `null`. There is no `GithubContext` and no Supabase client
anywhere in the repo; the real identity provider is Zitadel — see [../cloud/auth.md](../cloud/auth.md). The nearest live analogue is
`com`'s onboarding, which reads a `github_provider_token` from `sessionStorage`
(`com/src/routes/onboarding.tsx:42-63`) — also never written in this repo. GitHub linkage that *does* work
flows through the gateway and lands on the session as `githubRepo`/`githubUsername`.

## Environment variables

Consumed at build time by `resolveConfig` (`sdk/org/libs/auth/src/AuthProvider.tsx:12-15`, `39`):

| Var | Effect | Default |
|---|---|---|
| `VITE_COM_URL` | com auth-hub origin | `com.test` (dev) / `https://lmthing.com` (prod) |
| `VITE_CLOUD_URL` | gateway origin | `cloud.test` (dev) / `https://lmthing.cloud` (prod) |
| `VITE_DEMO_USER` | `'true'` forces demo session, bypassing all auth | unset |

## Integrating in a new SPA

Add `@lmthing/auth` (workspace dep), wrap the app once in `<AuthProvider appName="…">`, gate on `useAuth().isAuthenticated`/`isLoading`, and call `login()`/`logout()` — mirroring the unified app's root (`sdk/org/apps/web/src/routes/__root.tsx:15-25`). For calling gateway APIs use the context's `authFetch` (auto-refresh + 401 retry + pod-wake retry) rather than raw `fetch`.

## See also

- [../cloud/auth.md](../cloud/auth.md) — the server side: gateway JWT issuance, Zitadel, `/api/auth/sso/*` and `/api/auth/refresh`, SSO code minting.
