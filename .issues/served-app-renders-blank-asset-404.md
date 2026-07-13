# Every project app served on the clean URL renders BLANK (asset 404)

**Severity: high.** A built, working project app opens as an empty white page in production. The
data is fine, the API is fine, the build is fine — the browser never gets the bundle.

Found by scenario `06-tanzania` (Act XIV / the A2 browser pass) against live prod on 2026-07-13.

## What happens

`GET https://lmthing.app/<project>/` returns **200** with an HTML shell whose bundle references are
**root-absolute**:

```html
<script type="module" src="/assets/index-C6zkfNfK.js"></script>
<link rel="stylesheet" href="/assets/index-ChXjxEkU.css">
```

The app is mounted under `/<project>/`, so the browser resolves those against the ORIGIN root:

| URL the browser requests | status |
|---|---|
| `https://lmthing.app/assets/index-C6zkfNfK.js` | **404** |
| `https://lmthing.app/assets/index-ChXjxEkU.css` | **404** |

…while the very same bundle **does exist** one level down:

| URL | status |
|---|---|
| `https://lmthing.app/tanzania-trip/assets/index-C6zkfNfK.js` | **200** |

So the JS and the CSS both 404, React never mounts, and `<div id="root">` stays empty. Console shows
only `Failed to load resource: 404 (x2)`; the a11y tree is a bare `RootWebArea` with no content.
There is **no `<base>` tag** in the served HTML to rebase the relative paths either.

## Why it is not the page builder's fault

The project-app builder's own HTML template emits **relative** URLs on purpose —
`sdk/org/libs/cli/src/app/build/pages.ts#renderIndexHtml`, whose doc comment reads "The static HTML
shell — references the hashed bundle with **relative** URLs" and which writes `src="./${jsRel}"`.

The shell actually served is NOT that template's output: it carries a favicon block, Google-Fonts
preconnects and the early-wake beacon script, none of which `renderIndexHtml` produces. So something
in the serving layer (the `lmthing.app` root-mount / clean-URL rewrite) is answering `/<project>/`
with a different shell than the one the build produced.

## Where to look

- the `lmthing.app` clean-URL root mount (prod `/<project>/`, localhost `/app/<project>/`) — see the
  "App clean URLs" work; the rewrite serves the app but not with the app's own built `index.html`
- `sdk/org/libs/cli/src/app/build/pages.ts#renderIndexHtml` (produces the CORRECT relative shell)
- `sdk/org/libs/cli/src/server/routes/app-api.ts` — the api is mounted at `/app/<project>/api/*`,
  which is the second half of the problem (below)

## Related, probably the same root cause: the app's own API is unreachable

The pages fetch their data through `useApi(name)` → `apiCall` →
`resolveAppBase(window.location.pathname)`
(`sdk/org/libs/cli/src/app/runtime/client.ts#resolveAppBase`), which matches `…/app/<project>` and
otherwise falls back to `''`. On the clean-URL host the pathname is `/<project>/…` — no `/app/`
segment — so unless `window.__APP_BASE__` is injected (the documented escape hatch, and it is NOT in
the served HTML), every page fetches `/api/<route>` at the origin root. Probed live:

| URL | result |
|---|---|
| `https://lmthing.app/tanzania-trip/api/itinerary-list` | 200 **HTML shell** (not JSON) |
| `https://lmthing.app/api/itinerary-list` | 404 `{"error":"unknown API route GET /api/itinerary-list"}` |
| `https://lmthing.chat/app/tanzania-trip/api/itinerary-list` | 200 **HTML shell** |

So no reachable URL serves the app's own endpoints, even though the routes are declared, built and
listed in the manifest (`cost-list`, `itinerary-list`, `park-fees-list`, …) and the raw data API
(`/api/projects/<id>/app/data/<table>`) happily returns all 35 itinerary rows.

**This is exactly the failure the scenario campaign warns about:** the raw data API is green while
the layer the user actually sees is broken. Any check that only calls `/api/projects/<id>/app/data/…`
will report a healthy app that is, in a real browser, blank.

## Repro

```bash
cd sdk/org/scenarios/harness && node provision.mjs 06-tanzania   # or any user with a built app
# then, in a browser with the session injected on BOTH origins:
#   open https://lmthing.app/<project>/  → white page, two 404s in the console
curl -s -o /dev/null -w '%{http_code}\n' https://lmthing.app/assets/index-<hash>.js            # 404
curl -s -o /dev/null -w '%{http_code}\n' https://lmthing.app/<project>/assets/index-<hash>.js  # 200
```
