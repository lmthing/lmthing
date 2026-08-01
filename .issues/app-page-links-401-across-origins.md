# A project-app page cannot be opened from another lmthing surface — "Jwt is missing"

**Found:** 2026-08-01, verifying the chat's new app-page links against prod (`0fba54e`).

## What happens

Signed in on `lmthing.chat`, with the `blog` app installed in the pod, every route to one of
its pages ends in a 401 body of `Jwt is missing`:

| navigated to | final URL | result |
|---|---|---|
| `/app/blog/` (relative, from `/chat`) | `https://lmthing.app/blog/` | `Jwt is missing` |
| `https://lmthing.computer/app/blog/` | `https://lmthing.app/blog/` | `Jwt is missing` |
| `https://lmthing.app/blog/` | same | 401 `Jwt is missing` |
| `https://lmthing.app/apps` | same | `Jwt is missing` |

Adding the platform cookie by hand makes it work — `access_token=<gateway JWT>` on
`domain=lmthing.app; path=/` turns the same request into a `200` that serves the app shell.
So the pod, the route and the app are fine; the request simply arrives with no credential.

## Why

Apps are served from `lmthing.app` (`devops/argocd/envoy/app-policies.yaml`), and a page
navigation cannot carry an `Authorization` header — which is exactly why
`setPodSessionCookie` (`sdk/org/apps/web/src/lib/pod-session.ts`) exists: the shell mirrors the
JWT into a scoped `access_token` cookie so page + asset requests route to the user's pod.

That cookie can only be written **by a page already on `lmthing.app`**. `lmthing.app` and
`lmthing.chat` are different registrable domains, so a session held on the chat surface cannot
set it, and there is no cross-domain hand-off. The two shell routes that do write it
(`routes/apps/route.tsx`, `routes/install.tsx`) are themselves unreachable on that host —
Envoy reserves only `/`, `/api`, `/assets` and `/install` for the shell there and sends
everything else (including `/apps`) to the pod as if it were a project.

## Scope — this is not new

It is not caused by the chat's app-page links (`sdk/org/libs/ui/src/chat/app/AppPages.tsx`),
which only made an existing dead end visible and frequently travelled. The URL they build is
the same one `routes/apps/index.tsx` and `routes/install.tsx` have always opened
(`<computer origin>/app/<project>/`), and it fails identically from those pages.

## What a fix has to do

Get a credential onto the first `lmthing.app` navigation. Options, roughly in order of how
much they change:

1. **A one-time hand-off token in the URL** — the gateway already accepts `access_token` as a
   query param on the app routes (`app-policies.yaml`); the landing page could exchange it for
   the cookie and strip it from the URL. Cheapest, but puts a bearer token in a URL.
2. **Serve apps same-origin per surface** — let `lmthing.chat/app/<project>/` proxy to the pod
   instead of redirecting to `lmthing.app`, so the cookie the surface can already write applies.
3. **A gateway-set cookie scoped to the app host** at sign-in, via a redirect through
   `lmthing.app/install`-style landing.

Until one lands, the chips in `/chat` (and the Apps page) point at a URL that only works for a
reader who has separately signed in on `lmthing.app`.

## Reproduce

```bash
# mint a gateway session for a registered user (see CLAUDE.md), then:
curl -si https://lmthing.app/blog/ | head -3          # 401, "Jwt is missing"
curl -si https://lmthing.app/blog/ -H 'cookie: access_token=<JWT>' | head -3   # 200
```
