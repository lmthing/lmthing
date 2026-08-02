# `pages/` — a project-app's routes

A project-app's `pages/` directory is served as the app's file-routed route tree: every non-`_`-prefixed `.tsx`/`.jsx` file becomes a route, built once on save/boot (never per request) into a self-contained static bundle under `<projectRoot>/.data/pages-dist/` and served under `…/app/<project>/*` (`sdk/org/libs/cli/src/app/build/pages.ts:1-26`). There is no pod-side loader; a served page pulls data over HTTP through `@app/runtime`.

**A page is authored as a VIEW SPEC, not as hand-written TSX.** `views:write` is the only UI-authoring capability there is — it earns `writeProjectView(route, spec)`, which validates `spec` against the project's real endpoint contracts and writes `views/<route>.view.json` (`sdk/org/libs/cli/src/app/authoring/globals.ts#createProjectAuthoringGlobals`, DTS at `sdk/org/libs/core/src/typecheck/library-dts.ts#PROJECT_VIEW_DTS`). There is no capability, and no writer, that lands a freehand `pages/<route>.tsx` — that authoring surface and its `pages:write` capability id were removed from the codebase, so a spec is the only shape "author a page" can take for any agent. See [capabilities.md](../../space/agents/capabilities.md) for the grant model and [view-spec.md](./view-spec.md) for the spec format itself.

**`writeProjectView` writes ONLY the spec JSON (`views/<route>.view.json`) — nothing is generated beside it.** A spec app has no per-page `.tsx` and no per-project bundle: on the web it is rendered by a prebuilt SPA, the AppHost, which fetches the specs from `GET /api/apps/:id/views` and renders them through the shared `ViewRenderer` (`sdk/org/apps/app-shell/src/app-host.tsx#AppHost`, `sdk/org/libs/cli/src/server/routes/app-views.ts#handleAppViews`) — the SAME transport the native mobile app already uses (`sdk/org/apps/mobile/src/app-views.ts`). See [view-spec.md](./view-spec.md) for the spec format and the three validation tiers a spec goes through before it lands.

**The route tree described below is the LEGACY hand-written-TSX serving path** — still used by a project that ships `.tsx` pages (the store catalog, or a project built before the builder went spec-only). A spec app never touches it.

A hand-written `.tsx` page still SERVES if one already exists on disk (the store catalog ships some, and a project built before the builder went spec-only may have more) — the build pipeline below does not distinguish a generated wrapper from a hand-written page. A page missing a default export fails at BUILD time now (the esbuild bundle step, `sdk/org/libs/cli/src/app/build/pages.ts#buildProjectPagesChecked`), not at write time — the write-time check existed only in the now-removed `writeProjectPage`, and nothing writes a new TSX page for that check to run over.

## File routing

Route discovery walks `pages/`; every non-`_`-prefixed `.tsx`/`.jsx` file becomes a route (`sdk/org/libs/cli/src/app/build/pages.ts:155-182`). The route pattern is the file's path relative to `pages/`, with two rules: an `index` basename collapses to its directory's path, and a `[id]` segment becomes a `:id` dynamic param (`sdk/org/libs/cli/src/app/build/pages.ts:184-194`).

```
pages/index.tsx                      →  /
pages/discover.tsx                   →  /discover
pages/feed/[articleId].tsx           →  /feed/:articleId
pages/feed/[articleId]/research.tsx  →  /feed/:articleId/research
```

The route table above is grounded in `routePathFor` (`sdk/org/libs/cli/src/app/build/pages.ts:184-194`) and the matcher `matchRoutes`, which splits both request and pattern into segments and captures `:param` segments (`sdk/org/libs/cli/src/app/runtime/router.tsx#matchRoutes`). Dynamic-segment authoring uses `[seg]` wrapped in brackets; a view spec's own route grammar accepts the same `[param]` shape, further narrowed by `ROUTE_RE` (`sdk/org/libs/cli/src/app/view-spec/schema.ts#ROUTE_RE`). Directories named `components/` and `lib/` under `pages/` hold shared code, not routes, and are skipped during discovery (`sdk/org/libs/cli/src/app/build/pages.ts#walkPages`).

## Special files: `_app` / `_layout`

Two `_`-prefixed basenames are wrappers, not routes: `_app.tsx` (root wrapper — providers/context) and `_layout.tsx` (persistent chrome/shared layout), both optional (`sdk/org/libs/cli/src/app/build/pages.ts#WRAPPERS`, `sdk/org/libs/cli/src/app/build/pages.ts:305-314`). The router wraps the matched page as page-in-`_layout`-in-`_app` (`sdk/org/libs/cli/src/app/runtime/router.tsx#wrap`). Details → [app-file.md](./app-file.md) and [layout-file.md](./layout-file.md).

## `@app/runtime` — data hooks + routing

A page default-exports a React component and imports data/routing helpers from `@app/runtime`; the build aliases `@app/runtime` to this package's runtime source and `@app/types` to the project's generated dts (`sdk/org/libs/cli/src/app/build/pages.ts:472-473`, `sdk/org/libs/cli/src/app/build/pages.ts:249-250`). This is the surface a HAND-WRITTEN page imports from; a view spec imports nothing — the AppHost owns its routing and data fetching (see [../../../app/views.md](../../../app/views.md#the-viewrenderer--spec-pages-rendered-natively)).

| Import | Purpose | Returns |
|---|---|---|
| `useApi(name, input?, opts?)` | query an endpoint (GET/DELETE reads); refetches when `[name, JSON.stringify(input)]` changes | `{ data, error, isLoading, refetch }` (`sdk/org/libs/cli/src/app/runtime/hooks.tsx#useApi`) |
| `useApiMutation(name, { invalidates? })` | mutate via an endpoint (POST/PATCH/PUT) | `{ mutate, isPending, error }` (`sdk/org/libs/cli/src/app/runtime/hooks.tsx#useApiMutation`) |
| `apiCall(name, input?)` | imperative one-shot call | `Promise<unknown>` (parsed JSON body) (`sdk/org/libs/cli/src/app/runtime/client.ts#apiCall`) |
| `Link`, `navigate`, `useParams` | client-side routing | — (`sdk/org/libs/cli/src/app/runtime/router.tsx#Link`, `:121`, `:89`) |

`name` is the endpoint's stable exported name; `apiCall` looks it up in the injected endpoint manifest (`window.__APP_ENDPOINTS__`), fills `:param` segments from `input`, and routes GET/DELETE remainders to the query string and POST/PATCH/PUT remainders to the JSON body (`sdk/org/libs/cli/src/app/runtime/client.ts:8-14`, `sdk/org/libs/cli/src/app/runtime/client.ts#buildRequest`). See endpoint authoring → [../api/README.md](../api/README.md).

`useApi` re-fetches on mount and on input change, discards stale in-flight responses (last-write-wins via a request-id ref), and registers its refetch under `name` so a mutation can invalidate it (`sdk/org/libs/cli/src/app/runtime/hooks.tsx#useApi`). `useApiMutation`'s `mutate(input)` resolves the endpoint output and, on success, re-fetches every live query named in `invalidates` (`sdk/org/libs/cli/src/app/runtime/hooks.tsx#useApiMutation`, `sdk/org/libs/cli/src/app/runtime/hooks.tsx:41-47`).

Routing uses the History API: `navigate(to)` pushes state and re-renders (`sdk/org/libs/cli/src/app/runtime/router.tsx#navigate`); `<Link>` is an anchor that navigates client-side on a plain left-click and accepts both `to` and `href` (`sdk/org/libs/cli/src/app/runtime/router.tsx#Link`); `useParams()` reads the matched route's params (`sdk/org/libs/cli/src/app/runtime/router.tsx#useParams`). Route-table paths are authored base-agnostically (`/`, `/discover`); `Link`/`navigate` re-apply the `…/app/<project>` base via `toHref` so navigation stays inside the app (`sdk/org/libs/cli/src/app/runtime/router.tsx#toHref`).

## Styling — tokens-only hard gate

Pages must use the shared design-system tokens only — **never a raw color** (no hex, no literal `rgb()`/`hsl()`, no stock Tailwind color utilities like `gray-*`/`blue-500`); use `var(--foreground)`, `bg-primary`, `text-agent`, etc. (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:1-11`). The lint flags raw hex/`rgb()`/`hsl()` literals and stock Tailwind color-family utilities, allowing only token-based color functions (`rgb/hsl(var(--…))`) and achromatic overlay/scrim/shadow alphas (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:36-56`). It is a hard gate: the `lint:tokens` script (`package.json:14`) and the `design-tokens.yml` CI workflow (`.github/workflows/design-tokens.yml:39-43`) fail on any violation. Escape hatches are `ds-lint-ok` (per-line) and `ds-lint-file-ok` (per-file) (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:17-20`).

**Scope caveat — the gate does not actually cover template pages.** The linter walks only the roots handed to it on the command line (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:75-79`), and both scan lists name the store *SPA's* own source, `store/src` — never the project-app templates that live alongside it under `store/projects/<id>/pages` (`package.json:14`, `.github/workflows/design-tokens.yml:41-43`). The CI job *is* triggered by a change under `store/**` (`.github/workflows/design-tokens.yml:13`, `.github/workflows/design-tokens.yml:24`), but it then lints `store/src` only — so a raw color in a template page would not fail the build. The shipped templates comply anyway; check a tree yourself with `node sdk/org/libs/css/scripts/lint-design-tokens.mjs store/projects` (clean at time of writing). Treat the token-only rule as enforced by convention in `pages/`, not by CI.

Shared page components live in [../components/README.md](../components/README.md).

## Worked example — a hand-written (legacy) page

Nothing authors a page shaped like this anymore (see above), but it is what a served TSX page — a store-catalog app, or a project built before the builder went spec-only — looks like. Adapted from the real `store/projects/blog/pages/index.tsx` (`store/projects/blog/pages/index.tsx:1-27`) — a page that reads with `useApi`, mutates with `useApiMutation`, and fires a one-shot `apiCall`:

```tsx
import React from 'react';
import type { Article } from '@app/types';                 // generated from database/ schemas
import { useApi, useApiMutation, apiCall } from '@app/runtime';

export default function Feed() {
  const { data: articles, isLoading, error, refetch } = useApi<Article[]>('feedList', {});
  const markAllRead = useApiMutation<{ count: number }>('markAllRead', {
    invalidates: ['feedList', 'feedStats'],
  });

  const onPin = async (a: Article) => {
    await apiCall('pinArticle', { id: a.id, pinned: !a.pinned });
    refetch?.();
  };
  // …render with design tokens ONLY (bg-primary, text-muted-foreground, …)
}
```

The minimal `_app.tsx` root wrapper is a pass-through (`store/projects/blog/pages/_app.tsx:1-5`); see [app-file.md](./app-file.md).
