# `pages/` — client-side React routes

A project-app's `pages/` directory holds **real client-side React** — each non-`_`-prefixed `.tsx`/`.jsx` file is a file-routed page, built once on save/boot (never per request) into a self-contained static bundle under `<projectRoot>/.data/pages-dist/` and served under `…/app/<project>/*` (`sdk/org/libs/cli/src/app/build/pages.ts:1-26`). Pages are pure browser code — there is no pod-side loader; they pull data over HTTP through `@app/runtime` (`sdk/org/CLAUDE.md` "pages/ are real client-side React").

Pages are written by the capability-gated `writePage(route, src)` global (catalog authoring) and its live-project twin `writeProjectPage(route, src)`, both injected only when the agent holds the `pages:write` grant (`sdk/org/libs/cli/src/app/authoring/globals.ts:185-196`, `sdk/org/libs/cli/src/app/authoring/globals.ts:376-395`; DTS gated at `sdk/org/libs/core/src/typecheck/library-dts.ts:268`). See [capabilities.md](../../space/agents/capabilities.md) for the grant model.

## File routing

Route discovery walks `pages/`; every non-`_`-prefixed `.tsx`/`.jsx` file becomes a route (`sdk/org/libs/cli/src/app/build/pages.ts:155-182`). The route pattern is the file's path relative to `pages/`, with two rules: an `index` basename collapses to its directory's path, and a `[id]` segment becomes a `:id` dynamic param (`sdk/org/libs/cli/src/app/build/pages.ts:184-194`).

```
pages/index.tsx                      →  /
pages/discover.tsx                   →  /discover
pages/feed/[articleId].tsx           →  /feed/:articleId
pages/feed/[articleId]/research.tsx  →  /feed/:articleId/research
```

The route table above is grounded in `routePathFor` (`sdk/org/libs/cli/src/app/build/pages.ts:184-194`) and the matcher `matchRoutes`, which splits both request and pattern into segments and captures `:param` segments (`sdk/org/libs/cli/src/app/runtime/router.tsx:57-75`). Dynamic-segment authoring uses `[seg]` wrapped in brackets and the writer accepts it as a valid path segment (`sdk/org/libs/cli/src/app/authoring/globals.ts:53`). Directories named `components/` and `lib/` under `pages/` hold shared code, not routes, and are skipped during discovery (`sdk/org/libs/cli/src/app/build/pages.ts:173`).

## Special files: `_app` / `_layout`

Two `_`-prefixed basenames are wrappers, not routes: `_app.tsx` (root wrapper — providers/context) and `_layout.tsx` (persistent chrome/shared layout), both optional (`sdk/org/libs/cli/src/app/build/pages.ts:152`, `sdk/org/libs/cli/src/app/build/pages.ts:305-314`). The router wraps the matched page as page-in-`_layout`-in-`_app` (`sdk/org/libs/cli/src/app/runtime/router.tsx:167-176`). Details → [app-file.md](./app-file.md) and [layout-file.md](./layout-file.md).

## `@app/runtime` — data hooks + routing

A page default-exports a React component and imports data/routing helpers from `@app/runtime`; the build aliases `@app/runtime` to this package's runtime source and `@app/types` to the project's generated dts (`sdk/org/libs/cli/src/app/build/pages.ts:472-473`, `sdk/org/libs/cli/src/app/build/pages.ts:249-250`).

| Import | Purpose | Returns |
|---|---|---|
| `useApi(name, input?, opts?)` | query an endpoint (GET/DELETE reads); refetches when `[name, JSON.stringify(input)]` changes | `{ data, error, isLoading, refetch }` (`sdk/org/libs/cli/src/app/runtime/hooks.tsx:70-116`) |
| `useApiMutation(name, { invalidates? })` | mutate via an endpoint (POST/PATCH/PUT) | `{ mutate, isPending, error }` (`sdk/org/libs/cli/src/app/runtime/hooks.tsx:138-169`) |
| `apiCall(name, input?)` | imperative one-shot call | `Promise<unknown>` (parsed JSON body) (`sdk/org/libs/cli/src/app/runtime/client.ts:147-161`) |
| `Link`, `navigate`, `useParams` | client-side routing | — (`sdk/org/libs/cli/src/app/runtime/router.tsx:143`, `:121`, `:89`) |

`name` is the endpoint's stable exported name; `apiCall` looks it up in the injected endpoint manifest (`window.__APP_ENDPOINTS__`), fills `:param` segments from `input`, and routes GET/DELETE remainders to the query string and POST/PATCH/PUT remainders to the JSON body (`sdk/org/libs/cli/src/app/runtime/client.ts:8-14`, `sdk/org/libs/cli/src/app/runtime/client.ts:121-139`). See endpoint authoring → [../api/README.md](../api/README.md).

`useApi` re-fetches on mount and on input change, discards stale in-flight responses (last-write-wins via a request-id ref), and registers its refetch under `name` so a mutation can invalidate it (`sdk/org/libs/cli/src/app/runtime/hooks.tsx:82-116`). `useApiMutation`'s `mutate(input)` resolves the endpoint output and, on success, re-fetches every live query named in `invalidates` (`sdk/org/libs/cli/src/app/runtime/hooks.tsx:149-166`, `sdk/org/libs/cli/src/app/runtime/hooks.tsx:41-47`).

Routing uses the History API: `navigate(to)` pushes state and re-renders (`sdk/org/libs/cli/src/app/runtime/router.tsx:121-124`); `<Link>` is an anchor that navigates client-side on a plain left-click and accepts both `to` and `href` (`sdk/org/libs/cli/src/app/runtime/router.tsx:126-162`); `useParams()` reads the matched route's params (`sdk/org/libs/cli/src/app/runtime/router.tsx:89-91`). Route-table paths are authored base-agnostically (`/`, `/discover`); `Link`/`navigate` re-apply the `…/app/<project>` base via `toHref` so navigation stays inside the app (`sdk/org/libs/cli/src/app/runtime/router.tsx:96-114`).

## Styling — tokens-only hard gate

Pages must use the shared design-system tokens only — **never a raw color** (no hex, no literal `rgb()`/`hsl()`, no stock Tailwind color utilities like `gray-*`/`blue-500`); use `var(--foreground)`, `bg-primary`, `text-agent`, etc. (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:1-11`). The lint flags raw hex/`rgb()`/`hsl()` literals and stock Tailwind color-family utilities, allowing only token-based color functions (`rgb/hsl(var(--…))`) and achromatic overlay/scrim/shadow alphas (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:36-56`). It is a hard gate: the `lint:tokens` script (`package.json:14`) and the `design-tokens.yml` CI workflow (`.github/workflows/design-tokens.yml:39-43`) fail on any violation. Escape hatches are `ds-lint-ok` (per-line) and `ds-lint-file-ok` (per-file) (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:17-20`).

**Scope caveat — the gate does not actually cover template pages.** The linter walks only the roots handed to it on the command line (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:75-79`), and both scan lists name the store *SPA's* own source, `store/src` — never the project-app templates that live alongside it under `store/projects/<id>/pages` (`package.json:14`, `.github/workflows/design-tokens.yml:41-43`). The CI job *is* triggered by a change under `store/**` (`.github/workflows/design-tokens.yml:13`, `.github/workflows/design-tokens.yml:24`), but it then lints `store/src` only — so a raw color in a template page would not fail the build. The shipped templates comply anyway; check a tree yourself with `node sdk/org/libs/css/scripts/lint-design-tokens.mjs store/projects` (clean at time of writing). Treat the token-only rule as enforced by convention in `pages/`, not by CI.

Shared page components live in [../components/README.md](../components/README.md).

## Worked example

Adapted from the real `store/projects/blog/pages/index.tsx` (`store/projects/blog/pages/index.tsx:1-27`) — a page that reads with `useApi`, mutates with `useApiMutation`, and fires a one-shot `apiCall`:

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
