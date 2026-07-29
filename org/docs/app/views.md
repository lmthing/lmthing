# App views — the client layer of a project-app

> **Two builders, two view layers, one page.** `system-appbuilder` produces **React pages** —
> the whole of this document down to [Gotchas](#gotchas). `system-viewbuilder` produces **view
> specs**, rendered by a shared `ViewRenderer` that runs on the web bundle *and* natively in the
> mobile app with no WebView — [The ViewRenderer](#the-viewrenderer--spec-pages-rendered-natively)
> at the end. The two are interchangeable at one routing seam and never mix within an app. The
> spec FORMAT the model authors is [../format/project/pages/view-spec.md](../format/project/pages/view-spec.md).

A project-app's views are **real client-side React**. Every non-`_`-prefixed `.tsx`/`.jsx` under `<projectRoot>/pages/` is a file-routed page, bundled once (on save / boot / install — never per request) into a self-contained static bundle under `<projectRoot>/.data/pages-dist/` and served under `…/app/<project>/*` `sdk/org/libs/cli/src/app/build/pages.ts:1-26`. There is no pod-side loader and no descriptor flattening: a page is browser code that pulls its data over HTTP from the project's own `api/` endpoints through the `@app/runtime` module `sdk/org/libs/cli/src/app/runtime/index.ts:1-11`.

Everything a page may import from the platform is that one module. The build aliases `@app/runtime` to the CLI package's runtime **source** (`<cliRoot>/src/app/runtime/index.ts`) and `@app/types` to the project's generated dts, so neither is a real npm package `sdk/org/libs/cli/src/app/build/pages.ts:461-473`, `sdk/org/libs/cli/src/app/build/pages.ts:249-250`.

- Page/route file conventions (`index`, `[id]`, `_app`, `_layout`) → [../format/project/pages/README.md](../format/project/pages/README.md)
- The endpoints these views call → [../format/project/api/README.md](../format/project/api/README.md)
- The app's shared React library → [../format/project/components/README.md](../format/project/components/README.md)
- URL mounts, serving, CSP → [./routes.md](./routes.md) · build/db/hooks behavior → [./features.md](./features.md)

## The `@app/runtime` surface

The barrel exports exactly these values `sdk/org/libs/cli/src/app/runtime/index.ts:13-35`:

| Export | Signature | Kind |
|---|---|---|
| `apiCall` | `(name: string, input?: Record<string, unknown>) => Promise<unknown>` | data (bare one-shot) `…/runtime/client.ts:147` |
| `HttpError` | `class HttpError extends Error { status: number; details?: unknown }` | error contract `…/runtime/client.ts:45-56` |
| `resolveAppBase` | `(pathname: string, override?: string) => string` | base resolution `…/runtime/client.ts:78-83` |
| `buildRequest` | `(entry, input, base) => { method, url, init }` | pure request builder `…/runtime/client.ts:121-139` |
| `useApi` | `<T>(name, input?, opts?) => { data, error, isLoading, refetch }` | React query `…/runtime/hooks.tsx:70-116` |
| `useApiMutation` | `<T>(name, { invalidates? }) => { mutate, isPending, error }` | React mutation `…/runtime/hooks.tsx:138-169` |
| `useParams` | `<T>() => T` | routing `…/runtime/router.tsx#useParams` |
| `Link` | `(props: { to?: string; href?: string } & AnchorHTMLAttributes) => ReactElement` | routing `…/runtime/router.tsx#Link` |
| `navigate` | `(to: string) => void` | routing `…/runtime/router.tsx#navigate` |
| `mountApp` / `AppRoot` / `matchRoutes` | mount + match plumbing | used by the **generated entry**, not by page authors `…/runtime/router.tsx#mountApp` |
| `Chat` | `({ agent, projectId?, className?, title? }) => ReactElement` | self-floating agent chat widget `…/runtime/chat.tsx:74-89` |

(Paths above are under `sdk/org/libs/cli/src/app/`.) Types exported alongside: `EndpointManifest`, `EndpointManifestEntry`, `HttpErrorBody`, `QueryResult`, `UseApiOptions`, `UseApiMutationOptions`, `MutationResult`, `MountConfig`, `RouteEntry`, `PageComponent`, `WrapperComponent`, `ChatProps` `sdk/org/libs/cli/src/app/runtime/index.ts:14-36`.

## Views call the api by **name**, not by URL

A view addresses an endpoint by its stable exported `name` (`export const name = 'markRead'` in the handler — see [../format/project/api/README.md](../format/project/api/README.md)); the network layer addresses it by route. The bridge is the **endpoint manifest** `name → { method, routePath, inputSchema? }`, projected at build time from the typed `EndpointContract[]` `sdk/org/libs/cli/src/app/build/pages.ts#endpointManifest` and injected onto `window.__APP_ENDPOINTS__` by `mountApp` `sdk/org/libs/cli/src/app/runtime/router.tsx#mountApp`.

The manifest carries each endpoint's **Input JSON Schema** as well as its routing, because a `create` section declares no fields and derives every one of them from that schema — and on the web target there is no second source for it (the native target reads it from `GET /api/apps/:id/views`). Without it every `create` section in a browser-served viewbuilder app renders "Nothing to fill in." The same schema is what stops the renderer sending a route parameter to an endpoint that does not declare it `sdk/org/libs/ui/src/view/sections/common.tsx#useSectionSource`: every handler's Input is `additionalProperties: false` and ajv-validated pod-side, so an undeclared key is a 400 for the whole section. `apiCall` reads that manifest, and throws `HttpError(500, 'unknown endpoint "<name>"')` for an unknown name (or a 500 if the manifest was never injected) `sdk/org/libs/cli/src/app/runtime/client.ts#manifest`, `sdk/org/libs/cli/src/app/runtime/client.ts#apiCall`.

Request assembly is **method-aware** and mirrors the server's input assembly `sdk/org/libs/cli/src/app/runtime/client.ts#buildRequest`:

1. `:param` segments of `routePath` are filled from `input` and those keys are marked consumed `sdk/org/libs/cli/src/app/runtime/client.ts#fillPath`.
2. For `GET`/`DELETE` the remaining keys become the query string (objects `JSON.stringify`'d, `undefined`/`null` dropped) `sdk/org/libs/cli/src/app/runtime/client.ts:106-118`.
3. For `POST`/`PATCH`/`PUT` the remainder becomes a JSON body with `content-type: application/json` `sdk/org/libs/cli/src/app/runtime/client.ts#buildRequest`.
4. The URL is `` `${base}/api${path}` ``, i.e. `…/app/<project>/api/items/42` `sdk/org/libs/cli/src/app/runtime/client.ts#buildRequest`.

A non-2xx response is rethrown as `HttpError`, reusing the pod's `{ error: { status, message, details? } }` body — the same error shape the handler threw `sdk/org/libs/cli/src/app/runtime/client.ts#apiCall`, `sdk/org/libs/cli/src/app/api/errors.ts` (`HttpError`, `toErrorBody`).

### Base resolution (why the same bundle works on every mount)

`resolveAppBase(pathname)` derives the `…/app/<project>` prefix from `window.location.pathname` with `/^(.*?\/app\/[^/]+)/`, unless `window.__APP_BASE__` overrides it `sdk/org/libs/cli/src/app/runtime/client.ts#resolveAppBase`. The override exists for the `/app`-stripped root mount (`lmthing.app/<project>/…`, where the prefix isn't in the path): the page server injects `<base href="…">` plus a nonce'd `window.__APP_BASE__ = …` bootstrap into the shell's `<head>` `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`. One build, every prefix.

## `useApi` — the query hook

```tsx
const { data, error, isLoading, refetch } = useApi<T>(name, input = {}, { enabled = true });
```

- Fetches on mount and re-runs whenever `[name, JSON.stringify(input)]` changes; `enabled: false` skips fetching entirely (e.g. until a param is known) `sdk/org/libs/cli/src/app/runtime/hooks.tsx#useApi`, `sdk/org/libs/cli/src/app/runtime/hooks.tsx#UseApiOptions`.
- **Last-write-wins**: each run takes a monotonically increasing request id; a resolved response only commits if it is still the latest, so rapid input changes never flip `data` back to a stale value `sdk/org/libs/cli/src/app/runtime/hooks.tsx:82-101`.
- Any thrown non-`HttpError` is wrapped as `HttpError(500, String(err))`, so `error` is always an `HttpError | undefined` `sdk/org/libs/cli/src/app/runtime/hooks.tsx:96-99`, `sdk/org/libs/cli/src/app/runtime/hooks.tsx#QueryResult`.
- While enabled, the hook **registers its `refetch` under `name`** in an in-module `Map<string, Set<refetch>>` so a mutation can invalidate it `sdk/org/libs/cli/src/app/runtime/hooks.tsx:110-113`, `sdk/org/libs/cli/src/app/runtime/hooks.tsx:25-39`.

Nothing caches across components: two `useApi('feedList')` mounts issue two fetches. There is no external query library — the whole layer is ~170 lines `sdk/org/libs/cli/src/app/runtime/hooks.tsx:1-17`.

### `name` is typechecked against the project's own endpoints

The typecheck program does not declare `useApi(name: string, …)`. It generates the `@app/runtime` data-hook signatures from the project's OWN `api/` routes, so `name` is a **string-literal union** of real endpoint names and a `[id]` route gets its own overload with `input` **required** `sdk/org/libs/cli/src/app/build/apicall-dts.ts#buildClientApiDts` · `sdk/org/libs/cli/src/app/build/typecheck.ts:329-347`. Two failures that used to reach production are now build errors:

- **A name no endpoint exports.** `apiCall` throws `unknown endpoint` *before* issuing any request `sdk/org/libs/cli/src/app/runtime/client.ts:147-152`, so the page silently renders its error branch with nothing in the network panel — invisible to esbuild and to an HTTP probe alike.
- **A `[id]` route called without its param.** The client stringifies the missing value into the path `sdk/org/libs/cli/src/app/runtime/client.ts#fillPath`, producing `/api/trips/undefined`, which matches on segment count and passes the endpoint's ajv input validation — a plausible 200 carrying the wrong row.

The `<T>` type parameter is deliberately **kept and unconstrained**: pages author `useApi<Alert[]>('listAlerts')`, and binding the return type to the endpoint's declared `Output` would reject those call sites wholesale. Only the *name* is narrowed; response-shape agreement is enforced against the endpoint contract when the file is written, not here. A project with no `api/` directory yet keeps the generic `name: string` signatures so pages authored before their endpoints still compile.

## `useApiMutation` — the mutation hook

```tsx
const { mutate, isPending, error } = useApiMutation<T>(name, { invalidates: ['feedList'] });
await mutate({ id });   // resolves the endpoint's Output
```

`mutate(input)` calls `apiCall(name, input)`, and **on success only** re-fetches every live `useApi` query registered under each name in `invalidates` `sdk/org/libs/cli/src/app/runtime/hooks.tsx#useApiMutation`, `sdk/org/libs/cli/src/app/runtime/hooks.tsx:41-47`. Invalidation is explicit — a name not listed is not refreshed. A failure stores an `HttpError` in `error` **and rethrows it**, so `await mutate(...)` must be guarded if the caller cares `sdk/org/libs/cli/src/app/runtime/hooks.tsx:157-160`.

Real usage (`store/projects/demo-feed/pages/index.tsx#Feed`):

```tsx
const { data, isLoading, error } = useApi<FeedListOutput>('feedList', {});

const addItem  = useApiMutation<FeedItem>('addItem',   { invalidates: ['feedList'] });
const markRead = useApiMutation<{ ok: boolean }>('markRead', { invalidates: ['feedList'] });
```

`markRead` here is the `name` exported by `store/projects/blog/api/mark-read/POST.ts#name` — a rename of the *file* would not break the view; a rename of `name` would.

## Routing

The generated entry hands `mountApp` the route table, the wrappers and the manifest; `AppRoot` subscribes to `popstate` + the internal `lmthing:navigate` event, matches `window.location` against the table, and renders **page inside `_layout` inside `_app`** `sdk/org/libs/cli/src/app/runtime/router.tsx#AppRoot`, `sdk/org/libs/cli/src/app/runtime/router.tsx#wrap`.

- `matchRoutes(routes, clientPath)` — segment-count match, `:param` segments captured and `decodeURIComponent`'d; first match wins `sdk/org/libs/cli/src/app/runtime/router.tsx#matchRoutes`.
- `clientPath(pathname)` — the pathname minus the resolved app base, so route-table paths stay base-agnostic (`/`, `/feed/:articleId`) `sdk/org/libs/cli/src/app/runtime/router.tsx#clientPath`.
- `useParams<T>()` — the matched params from React context; `{}` outside a route `sdk/org/libs/cli/src/app/runtime/router.tsx#useParams`. A page also receives them as its `params` prop (`PageComponent` is `ComponentType<{ params: Record<string,string> }>`) `sdk/org/libs/cli/src/app/runtime/router.tsx#PageComponent`.
- `navigate(to)` — `history.pushState(toHref(to))` + dispatch the nav event `sdk/org/libs/cli/src/app/runtime/router.tsx#navigate`.
- `Link` — an `<a>` whose rendered `href` carries the base (so middle-click / copy-link work) and whose plain left-click navigates client-side; modified clicks and `defaultPrevented` fall through to the browser `sdk/org/libs/cli/src/app/runtime/router.tsx#Link`. It accepts **both `to` and `href`** (`to` wins) and pulls both out of the spread so a caller's `href` cannot override the based one `sdk/org/libs/cli/src/app/runtime/router.tsx#Link`.
- `toHref(to)` re-applies the `…/app/<project>` base to an app-relative path; external, protocol-relative (`//…`), hash and already-based paths pass through unchanged `sdk/org/libs/cli/src/app/runtime/router.tsx#toHref`. Without it, `navigate('/discover')` would push an origin-absolute URL and leave the app entirely.
- No match → a token-styled `NotFound` ("No page for `<path>`") `sdk/org/libs/cli/src/app/runtime/router.tsx#NotFound`.
- **A page's render crash is contained to that page.** The matched page (or `NotFound`) renders inside a `PageErrorBoundary`, *inside* `_layout`, keyed by the client path `sdk/org/libs/cli/src/app/runtime/router.tsx#PageErrorBoundary`. Pages are LLM-authored and bound to a live, drifting database, so one eventually meets a null it did not expect — scenario 07's invoices page called `.toFixed()` on a NULL column, and because React unmounts the whole tree on an uncaught render error, the user got a **blank page for the entire app**, assistant dock included, while every route still returned 200. The boundary costs the crash only that page's body: the layout, the nav and the dock survive, the message is shown (and logged), and navigating away resets it (the `key`).

Both prop styles appear in shipped apps: `<Link href="/new" …>` (`store/projects/trips/pages/index.tsx:14-19`) and `useParams<{ searchId?: string }>()` inside a `_layout` (`store/projects/homes/pages/_layout.tsx:11`).

## `<Chat>` — the self-floating, one descriptor-rendering view

`<Chat agent="…" projectId? className? title? />` drops a **self-floating** live agent session into a page `sdk/org/libs/cli/src/app/runtime/chat.tsx:74-89`. It owns its own chrome — a fixed-position launcher button in the bottom-right corner (`role="button"`, closed state), and on click a `role="dialog"` panel: a full-screen sheet under a `(max-width: 640px)` media query, a `24rem`-wide corner card above it `sdk/org/libs/cli/src/app/runtime/chat.tsx:56-70`, `sdk/org/libs/cli/src/app/runtime/chat.tsx:203-209`. Open/closed state is restored per-agent from `localStorage` (`lmthing.chat.<agent>.open`), so multiple `<Chat>` widgets on one page don't collide `sdk/org/libs/cli/src/app/runtime/chat.tsx:90-108`. Callers never build a dock around it — a caller that still wraps `<Chat>` in its own fixed-position toggle produces two overlapping launcher buttons.

Inside the open panel it renders the **same connected-session surface as `AgentChatPanel`** (studio's embeddable panel) via the shared `ReplChatView` component `sdk/org/libs/ui/src/chat/components/ReplChatView.tsx`, including its "↻ Restart" control. It is the **only** place the `@lmthing/ui` catalog descriptor renderer (`DisplayBlock`/`AskBlock`/`VariablesBlock`) lives inside a page app — pages are otherwise plain React `sdk/org/libs/cli/src/app/runtime/chat.tsx:1-15`. It reuses the standard pod chat protocol wholesale: `POST /api/sessions` → `ReplChatView` (`useReplSession({ baseUrl, sessionId, accessToken })`) → `WS /api/ws?sessionId=<id>`, with `ask()` answers round-tripping over the same socket `sdk/org/libs/cli/src/app/runtime/chat.tsx:16-25`. `<Chat>` creates the session itself rather than through `AgentChatPanel`'s `ReplRpcClient.createSession` (`{ spaceDir, agentSlug }`) because Phase 7A's endpoint takes `{ spaceRef|agentSlug, projectId }` — everything downstream of session creation is the identical shared component. The session is created eagerly on mount regardless of open/closed state, so the panel is already connected the moment the launcher is clicked `sdk/org/libs/cli/src/app/runtime/chat.tsx:136-144`. `projectId` defaults to the `…/app/<project>` segment of the URL. The platform `@lmthing/auth` Bearer token is attached to both the session-create POST and the WS, because the pod's `/api/*` proxy is JWT-gated `sdk/org/libs/cli/src/app/runtime/chat.tsx:48-55`, `sdk/org/libs/cli/src/app/runtime/chat.tsx:190`. Session endpoints → [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

**`agent` picks which agent, and the shape of the session body follows from it** `sdk/org/libs/cli/src/app/runtime/chat-protocol.ts#sessionCreateBody`: a `"space/agent"` ref → `{ spaceRef, projectId }`, a **project space's** agent (a concierge, a curator). A **bare slug** — `agent="thing"` — → `{ agentSlug, projectId }`, the project's own top-level agent: the same THING the `/chat` surface talks to, scoped to this project, with its **full authoring capability**, so from inside the app the user can ask for a new table/page/space and it lands live. THING is not a project space, so a `spaceRef` cannot name it — before this an app-embedded chat could only reach a lesser agent. Both shapes are accepted by the create-session route `sdk/org/libs/cli/src/server/routes/sessions.ts:20-35`.

**Every app the automator builds ships a bare `<Chat agent="thing" title="Assistant" />` in `pages/_layout`** — the persistent chrome the router wraps every route in `sdk/org/libs/cli/src/app/runtime/router.tsx#wrap` — so the assistant is on every page by construction, not page-by-page, and never a hand-rolled dock around it (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md:491-517`). A link back to `/chat` is not a dock.

## `@app/types` — generated from `database/` + `api/`

`generateAppTypes(projectRoot)` loads the project's tables and api routes, renders row interfaces + endpoint I/O types, and **writes `<projectRoot>/types/generated.d.ts`** — a git-ignored build artifact, regenerated on every build (`runBuild` calls it before bundling) `sdk/org/libs/cli/src/app/build/schema.ts#generateAppTypes`, `sdk/org/libs/cli/src/app/build/pages.ts:219-221`. The build aliases `@app/types` to that file, and only when it exists `sdk/org/libs/cli/src/app/build/pages.ts:249-250`.

**Row types** — one `export interface` per `database/<table>.json`, tables sorted for deterministic output `sdk/org/libs/cli/src/app/build/schema.ts:95-120`:

| Column `type` | TS |
|---|---|
| `string` | `string` |
| `number` | `number` |
| `boolean` | `boolean` |
| `date` | `string` (ISO) |
| `json` | `unknown` |

(`sdk/org/libs/cli/src/app/build/schema.ts#COLUMN_TS`.) A **required or primary-key** column is non-optional; every other column gets `?`; each field carries the schema's `description` as JSDoc `sdk/org/libs/cli/src/app/build/schema.ts#renderRowInterface`. Relations are appended as optional typed fields — `hasMany` → `Target[]`, `belongsTo` → `Target` — present only when the query `include`s them `sdk/org/libs/cli/src/app/build/schema.ts:112-127`. The interface name is the PascalCased table basename with its **last word singularized** (`feed_items` → `FeedItem`, `categories` → `Category`, but `status`/`address`/`axis` tails are left alone) `sdk/org/libs/cli/src/app/build/schema.ts:137-155`.

**Endpoint types** — for each endpoint, the handler's `export interface Input` / `Output` are turned into JSON Schema by `ts-json-schema-generator` (one generator per handler file, `skipTypeCheck`), the root `$ref` is inlined so the schema is directly ajv-usable, and a compact TS-type string is printed `sdk/org/libs/cli/src/app/build/schema.ts:179-213`, `sdk/org/libs/cli/src/app/build/schema.ts#resolveRootSchema`. Each endpoint then emits `<Name>Input` / `<Name>Output` declarations (PascalCased `name`) into the dts `sdk/org/libs/cli/src/app/build/schema.ts#renderGeneratedDts`. A handler with no `Input` yields an empty-object schema `sdk/org/libs/cli/src/app/build/schema.ts:162-165,197-201`.

The same `EndpointContract[]` feeds three other consumers — the request validators (ajv), the agent's typed `apiCall` DTS overload, and the client endpoint manifest — so a view, a handler and an agent all see one contract `sdk/org/libs/cli/src/app/build/contracts.ts` (`generateProjectContracts`), `sdk/org/libs/cli/src/app/build/pages.ts#endpointManifest`.

A view imports row types straight from the alias:

```tsx
import type { Article } from '@app/types';
import { useApi, useApiMutation, apiCall, Link } from '@app/runtime';

export default function ArticleDetail({ params }: { params: { articleId: string } }) {
  const { articleId } = params;
  const { data: article, isLoading, error, refetch } = useApi<Article>('getArticle', { id: articleId });
  const saveArticle = useApiMutation<{ ok: boolean }>('saveArticle', {
    invalidates: ['getArticle', 'feedList', 'feedStats'],
  });
  // …
}
```
(`store/projects/blog/pages/feed/[articleId].tsx:1-27`.)

## Design tokens — the styling rule

Views must style with **design tokens only** — no hex, no literal `rgb()/hsl()`, no stock Tailwind color utilities (`gray-*`/`blue-*`/`green-500`); use `bg-background`, `text-foreground`, `bg-primary`, `border-border`, `var(--destructive)`, …. The rule is stated and enforced by the linter itself (`sdk/org/libs/css/scripts/lint-design-tokens.mjs:5-10`); the full ruleset is [`../design-system/README.md`](../design-system/README.md). The runtime itself obeys it: `NotFound` is `text-muted-foreground p-4` `sdk/org/libs/cli/src/app/runtime/router.tsx#NotFound` and `<Chat>` (plus the shared `ReplChatView` it renders through) styles exclusively with `var(--primary)`, `var(--card)`, `var(--border)`, `var(--foreground)`, `var(--muted-foreground)` `sdk/org/libs/cli/src/app/runtime/chat.tsx:243-321`, `sdk/org/libs/ui/src/chat/components/ReplChatView.tsx:156-234`. `<Chat>` uses inline `style` objects rather than Tailwind utility classes for this reason: the pages build's Tailwind scanner only walks the project's own `pages/`/`components`/`lib` dirs plus `@lmthing/ui`'s dist — not `@app/runtime`'s — so a utility class written in `chat.tsx` would never be generated `sdk/org/libs/cli/src/app/runtime/chat.tsx:26-31`, `sdk/org/libs/cli/src/app/build/pages.ts#resolveDesignSystem`. Shipped pages follow suit (`store/projects/trips/pages/index.tsx:13-25`).

The tokens are made to *work* by the build: the generated HTML shell pins `data-theme="light"` so project apps start on the light token set, while the generated entry imports a synthesized `app.css` that `@import`s `@lmthing/css`'s theme, declares `@source` globs over the project's `pages/`, `components/`, `lib/` plus the design-system source trees, and applies `bg-background text-foreground font-sans antialiased` to `body` `sdk/org/libs/cli/src/app/build/pages.ts#renderIndexHtml`, `sdk/org/libs/cli/src/app/build/pages.ts#renderAppCss`, `sdk/org/libs/cli/src/app/build/pages.ts#renderEntry`. A Tailwind-v4 esbuild plugin compiles it (esbuild alone cannot expand `@theme`/`@apply`) `sdk/org/libs/cli/src/app/build/pages.ts:231-236`, and `@lmthing/css` / `@lmthing/ui` are located via `resolveDesignSystem`; if they are unresolvable the build proceeds *without* the stylesheet rather than failing `sdk/org/libs/cli/src/app/build/pages.ts:542-566`. Pages may import `@lmthing/ui` elements — a build-only plugin rewrites `@lmthing/ui/elements/<dir>` to its concrete `index.*` because esbuild honors `exports` maps exactly `sdk/org/libs/cli/src/app/build/pages.ts:504-532`.

For views the rule is an **authoring mandate, not an automated gate**. The linter walks only the roots it is handed on argv `sdk/org/libs/css/scripts/lint-design-tokens.mjs:75-90`, and both the root `pnpm lint:tokens` script and the CI job pass the same SPA source trees — `sdk/org/libs/{css,ui}/src`, `sdk/org/apps/web/src`, `com/src social/src store/src space/src blog/src casa/src`, `org/src` — never `store/projects/` or a pod project root `package.json:14`, `.github/workflows/design-tokens.yml:39-43`. (The workflow *triggers* on `store/**`, so touching a shipped project app runs the job — it just never lints that app's pages `.github/workflows/design-tokens.yml:6-27`.) The page build has no color-lint step either `sdk/org/libs/cli/src/app/build/pages.ts`. What actually holds the line for generated apps is the appbuilder prompt: the automator agent and its `implement_pages` tasklist step both mandate tokens only — "never a raw hex, `rgb()/hsl()`, or a stock Tailwind color" `sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md:36-42`, `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/15-implement_pages.md:40-41`.

## Gotchas

- **`mountApp` is not a page API.** It is called only by the entry the build generates in `<projectRoot>/.data/pages-build/entry.tsx`, which imports the pages + `_app`/`_layout`, embeds the route table and manifest, and mounts `AppRoot` `sdk/org/libs/cli/src/app/build/pages.ts#renderEntry`.
- **Runtime-only fixes need `BUILDER_VERSION` bumped.** The build cache hashes only the project's own `pages/`/`components/`/`lib/`/`package.json`; a change to `@app/runtime` reaches already-built apps only when `BUILDER_VERSION` (currently `'7'`) changes `sdk/org/libs/cli/src/app/build/pages.ts#BUILDER_VERSION`.
- **Views are built, not rendered per request.** The page server only reads a cached `{ outDir, assetManifest }`; a path not in the manifest falls back to `index.html`, which is what makes dotted dynamic params route client-side `sdk/org/libs/cli/src/app/pages-serve.ts:1-46`.
- **Inline `<script>` is blocked.** Served pages carry a strict CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; …`), with a per-response nonce only for the `__APP_BASE__` bootstrap — so LLM-authored view content cannot inject executable script `sdk/org/libs/cli/src/app/pages-serve.ts#CSP`, `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`.

---

# The ViewRenderer — spec pages, rendered natively

Everything above describes a page that is **React the model wrote**. A `system-viewbuilder` page
is not code at all: it is a **spec**, a plain object validated at save time against the project's
endpoint contracts and drawn by one shared renderer. Because a spec is DATA, the mobile app can
fetch it and render it with the same component the web bundles — which is the one thing no amount
of improvement to a TSX-authoring builder can produce, since its output is an esbuild browser
bundle.

The renderer lives in `@lmthing/ui`, not in the CLI, precisely so both consumers can import it
`sdk/org/libs/ui/package.json:12`.

## The contract

```tsx
import { ViewRenderer, ViewThemeProvider, createViewClient } from '@lmthing/ui/view'

const client = createViewClient({ baseUrl, getToken, endpoints })
<ViewRenderer spec={spec} components={components} shell={shell} client={client} route={route} />
```

`ViewThemeProvider` is the theme context the renderer's `Prim.*` primitives require — every one of
them calls Tamagui's `useTheme()`, which throws `Missing theme.` outside a provider
`sdk/org/libs/ui/src/view/provider.tsx#ViewThemeProvider`. A host that already has one does **not**
wrap it (the unified web SPA at `sdk/org/apps/web/src/routes/__root.tsx:22-29`, the mobile app at
its own root); the **generated web wrapper** does, because a project-app page bundle has no root of
its own `sdk/org/libs/cli/src/app/view-spec/wrapper.ts#renderViewWrapper`.

`ViewRenderer` takes the page spec, the component definitions a `{ use: … }` reference resolves
against, the app shell, the data client, optionally every route in the app (for shell derivation)
and optionally the current route `sdk/org/libs/ui/src/view/renderer.tsx#ViewRendererProps`.
`components` accepts an array or a name-keyed map `sdk/org/libs/ui/src/view/renderer.tsx#toComponentMap`.
The spec types are a **structural mirror** of the pinned contract in
`sdk/org/libs/cli/src/app/view-spec/schema.ts` rather than an import of it, because `@lmthing/cli`
depends on `@lmthing/ui` and importing back would be a package cycle — and because that module is
node code (ajv, `fs`) that must never reach the Metro graph
`sdk/org/libs/ui/src/view/types.ts:1-30`.

## The client — one code path, two configurations

A spec names endpoints, never URLs and never fetch code. `createViewClient` turns a name into a
request with exactly `@app/runtime`'s `buildRequest` semantics — `:param` segments filled from
`input` and consumed, `GET`/`DELETE` remainders to the query string, `POST`/`PATCH`/`PUT`
remainders to a JSON body `sdk/org/libs/ui/src/view/client.ts#buildViewRequest`. Those semantics
are re-implemented rather than imported for the cycle reason above, and pinned against the same
cases as the CLI copy `sdk/org/libs/ui/src/view/client.test.ts:31-64`.

| | web (a generated wrapper page) | native (`apps/mobile`) |
|---|---|---|
| `baseUrl` | the app base (`…/app/<project>`), relative | the **absolute** pod URL |
| `getToken` | omitted — the pod is same-origin and cookie-authed | the pod token, sent as `Authorization: Bearer` |
| `endpoints` | injected as `window.__APP_ENDPOINTS__` | from `GET /api/apps/:id/views` |

Nothing in the client assumes an origin — the `createTeamClient` pattern
(`sdk/org/libs/ui/src/team/client.ts#createTeamClient`) applied to app data
`sdk/org/libs/ui/src/view/client.ts#createViewClient`.

**Host capabilities are symmetric.** `navigate`, `openExternal`, `copyToClipboard`, `print`,
`saveFile` and `confirm` are things only the host can do, so they are configuration; the native
host supplies them (`Linking`, `expo-clipboard`, `Alert`) and the web side falls back to the
browser's own implementation when a DOM is present, so a `{ copy }` button cannot work on a phone
and silently do nothing in a browser `sdk/org/libs/ui/src/view/client.ts#webCopy`. `navigate` is
deliberately **not** defaulted: routing belongs to the host's router, and a guessed
`location.assign` would break a SPA's history rather than degrade
`sdk/org/libs/ui/src/view/client.ts:180-196`.

## The runtime the spec replaces

The renderer owns the whole `useApi` lifecycle, per `ViewRenderer` instance rather than in a
module-level registry — a mobile host renders a spec, navigates, and renders another
`sdk/org/libs/ui/src/view/runtime.tsx#ViewRuntimeProvider`:

- **fetch on mount and on input change**, keyed by the serialised input so a fresh object literal
  each render does not re-fire `sdk/org/libs/ui/src/view/runtime.tsx#useViewQuery`;
- **last-write-wins stale-drop** — every fetch takes a request id and a response that is not the
  latest is discarded, so rapid facet changes cannot flip `data` back
  `sdk/org/libs/ui/src/view/runtime.tsx#useViewQuery`;
- **an invalidation registry keyed by endpoint name** — the only identifier a spec has. A
  mutation always invalidates its own name as well, so a section reading an endpoint that is also
  written to (a toggle) sees its own write `sdk/org/libs/ui/src/view/runtime.tsx#useViewMutation`;
- **`poll {everyMs, while:{field, in:[…]}}`** — a named declarative policy, not a predicate:
  refetch while `while.field` holds one of `while.in`, evaluated **per row and true if any row
  matches** `sdk/org/libs/ui/src/view/bind.ts#pollWhileHolds`;
- **`async {note, refetchAfter}`** on a `create` — a background import shows the note and
  re-invalidates after N ms `sdk/org/libs/ui/src/view/sections/create.tsx#CreateSectionView`;
- **per-section `isLoading` / `isFetching` / `error`**, distinguishing a first load from a poll
  refresh `sdk/org/libs/ui/src/view/runtime.tsx#QueryState`;
- **`selectable` + `bulkActions`** — the selection is sent under the Input key named by the
  mutation's `arg`, because there is deliberately no `$selection` binding root
  `sdk/org/libs/ui/src/view/runtime.tsx#useSelection`, `sdk/org/libs/ui/src/view/actions.tsx#useDispatch`.

**A dependent query with an unresolved binding is DISABLED, not sent with holes in it.** Each
section publishes its Output under its `id`, a dependent section reads it as an ordinary
`$data.<id>.…` binding, and `resolveInputs` reports `ready: false` until every binding resolves —
which is what replaces the hand-coded `enabled:` flag on every dependent query in the corpus
`sdk/org/libs/ui/src/view/bind.ts#resolveInputs`, `sdk/org/libs/ui/src/view/runtime.tsx#usePublish`.
There is no topological sort: React's render already is one, so the page scope is simply rebuilt
when the published data changes `sdk/org/libs/ui/src/view/renderer.tsx#ViewPage`.

## Bindings are paths, and a null one omits its element

The evaluator is a **walker, not an interpreter** — there is no `eval`, no expression parser and
no template interpolation anywhere in the renderer, which is what makes "no app-authored code ever
executes on the phone" true by construction `sdk/org/libs/ui/src/view/bind.ts#resolveBinding`. The
eight roots are `$`, `$.field`, `$props.x`, `$route.id`, `$data.<sectionId>.<path>`,
`$result.field`, `$form.field` and `$client.timezone`; anything else resolves to `undefined`
rather than throwing.

**S1 — a bound value that resolves to nothing renders NOTHING, its label and wrapper included.**
A literal is never omitted. That asymmetry is the whole rule
`sdk/org/libs/ui/src/view/bind.ts#resolveValue`: it replaces the ~15 hand-written
`{x ? … : null}` guards the desk check found across ten pages, and it is what keeps the
no-conditionals rule honest — without it every spec page fills with empty chrome. A falsy *number*
or *boolean* is present (`0` items is a fact worth showing); an empty string or empty array from a
binding is not. It applies per keyvalue pair (an unpopulated field takes its label with it
`sdk/org/libs/ui/src/view/elements.tsx#KeyValueRows`) and per stats card (a metric the endpoint did
not compute leaves no tile reading "—" `sdk/org/libs/ui/src/view/sections/misc.tsx#StatsSectionView`).

## Loading, empty and error are RENDERER DEFAULTS

The completeness audit found **26 of 153** hand-built components across five apps were skeletons,
spinners, empty states and error notes — ~1,050 LOC that vanish here, 31% of the components that
disappear before any mapping (`design/viewspec-element-audit.md:57-74`). They are supplied by the
renderer and **there is deliberately no way to author one**: no `skeleton`, no `spinner`, no
`loading`, no `error` in the element catalogue `sdk/org/libs/ui/src/view/states.tsx:1-24`.

- **Loading** is a shaped placeholder, not a spinner — the shape is derived by the section from
  what it is about to draw, never authored `sdk/org/libs/ui/src/view/states.tsx#LoadingState`.
- **Error** names the failure and offers a **retry**, so a transient 502 from a pod that just woke
  does not need a page reload `sdk/org/libs/ui/src/view/states.tsx#ErrorState`.
- **Empty** always exists; a section's `empty:` is an *override* of it, not the authoring of a
  state. The default title is derived from the endpoint name
  `sdk/org/libs/ui/src/view/sections/common.tsx#SectionFrame`.
- A section that **throws** is contained: the rest of the page still renders and the failing
  section names itself, because a whole-page white screen is indistinguishable from "the builder
  produced nothing" `sdk/org/libs/ui/src/view/renderer.tsx#SectionBoundary`.
- **A row shape is derived from the data** when `item` is absent, which is what keeps
  `{ kind: 'list', query: 'X' }` a legal page rather than a blank one
  `sdk/org/libs/ui/src/view/sections/common.tsx#deriveItem`.

## Layout prediction — archetypes

A page's `layout` is normally absent and the archetype is predicted from the section composition
`sdk/org/libs/ui/src/view/archetype.ts#predictArchetype`. How often the model must set it
explicitly is the plan's **layout-override rate** ratchet metric, which is why the decision records
whether it was `authored` `sdk/org/libs/ui/src/view/archetype.ts#ArchetypeDecision`.

| composition | archetype |
|---|---|
| `stats` + ≥2 collections | `dashboard` |
| `detail` (+ related collections) | `detail` |
| `create` + a collection **on the same entity** | `list`, create as a collapsible header form |
| a single collection | `list` |
| create only | `form` |
| anything else | **`stack`**, the explicit fallback |

Three rules are load-bearing:

1. **An archetype NEVER reorders sections.** Section order is the array order. A "dashboard ⇒
   stats strip on top" heuristic would bury `kitchen/index`'s hero card, the one thing that page
   exists to show. Archetypes govern container width, grid columns and responsive collapse only —
   the decision object carries no ordering at all
   `sdk/org/libs/ui/src/view/archetype.ts#ARCHETYPE_WIDTH`, `sdk/org/libs/ui/src/view/archetype.ts#isGridCell`.
2. **`create` + `list` on one entity** is the commonest real shape (5 of the 10 desk-checked
   pages). The pairing is recognised from the create's `invalidates` — the model stating the
   relationship outright — falling back to the entity noun with its verb stripped
   `sdk/org/libs/ui/src/view/archetype.ts#sameEntity`, `sdk/org/libs/ui/src/view/archetype.ts#entityOf`.
3. **`master-detail` was exercised by zero of the ten measured pages.** It stays in the union, but
   the shape that would be master-detail deliberately renders as a detail page rather than
   sinking v1 time into split-pane logic; promoting it is a bucket-1 decision with evidence
   attached `sdk/org/libs/ui/src/view/archetype.test.ts:113-119`.

**Responsive behaviour lives inside the archetype**, via the Tamagui media breakpoints already
aligned to Tailwind's (`sdk/org/libs/css/src/tamagui/tokens.generated.ts:724-742`). The model never
writes a breakpoint.

Sections named by any `reveals` anywhere on the page start **hidden**; a section nothing reveals is
always shown, which is why the target set is computed page-wide rather than per section
`sdk/org/libs/ui/src/view/archetype.ts#revealTargetsOf`. `reveals` is the declarative replacement
for `useState`, and a press shows or hides all of a group at once — per-id toggling left a
partially-open page in every measured layout `sdk/org/libs/ui/src/view/runtime.tsx#ViewRuntimeProvider`.

## Layout prediction — the shell

The shell replaces the `_app.tsx`/`_layout.tsx` every catalogue app hand-writes. Nav is derived
from the route list **only up to `SHELL_DERIVE_MAX_ROUTES` (5) top-level static routes**
`sdk/org/libs/ui/src/view/types.ts#SHELL_DERIVE_MAX_ROUTES`; above that the model must declare
`groups` and the renderer derives nothing, reporting why
`sdk/org/libs/ui/src/view/shell.tsx#deriveNav`.

That threshold is measured, not taste: the desk check found **0 of 5** catalogue apps reproducing
from a flat route list — four hand-group 13–21 routes into 4–6 destinations, and a flat mapping
produces an unusable 13–21-item bottom bar on a phone. Deriving anyway would put the shell's own
layout-override rate near 80%, which by the plan's own metric means the *prediction* is wrong.

- **A parameterised route is never a nav item** — `/feed/[articleId]` is a drill-in, not a
  destination. It reaches the user through a `rowAction`, a `navigate`, or a subnav
  `sdk/org/libs/ui/src/view/shell.tsx#isStaticRoute`.
- **Placement is target-predicted**: bottom tabs on a phone, a top bar on a wide screen with few
  destinations, a sidebar above four. All three are one tree with media-driven visibility, so
  there is no platform branch anywhere in the file `sdk/org/libs/ui/src/view/shell.tsx#ViewShell`.
- **Subnav** is entity-scoped and declared **once** per route family: `match` is a parameterised
  prefix (`trips/[tripId]`), matched by segment shape, and the current route's parameter values
  carry into every item — so an item is written once as `trips/[tripId]/expenses`, not once per
  trip and not once per page `sdk/org/libs/ui/src/view/shell.tsx#subnavFor`,
  `sdk/org/libs/ui/src/view/shell.tsx#matchesPrefix`. Without it a spec app's per-entity pages
  cannot reach each other at all.
- **Nav badges** are declared as a data source (an endpoint name plus a path into its Output), so
  they resolve at save time like everything else; a zero draws nothing. These apps run on
  background agents and the badge *is* the "something needs you" signal they produce
  `sdk/org/libs/ui/src/view/shell.tsx#BadgeCount`.
- **`shell.assistant`** is the `chat` section hoisted into the frame — the concierge dock 4 of the
  5 catalogue apps hand-build `sdk/org/libs/ui/src/view/shell.tsx#ViewShell`.

## Forms come from the endpoint's Input schema

A `create` section **declares no fields**. They derive from the mutation endpoint's Input JSON
Schema, following the `SettingsSchemaForm` precedent
(`sdk/org/libs/ui/src/elements/forms/settings-schema-form/index.tsx#SettingsSchemaForm`) and
extending it with the three cases the desk check blocked on
`sdk/org/libs/ui/src/view/form.tsx#deriveFields`, `sdk/org/libs/ui/src/view/form.tsx#controlFor`:

- **enums ⇒ selects**;
- **array-of-object ⇒ repeating row groups** (`homes/new`'s commute targets)
  `sdk/org/libs/ui/src/view/form.tsx#ObjectListField`;
- **`x-options` ⇒ endpoint-sourced options** — without it a foreign key renders as a raw UUID text
  box `sdk/org/libs/ui/src/view/form.tsx#QuerySelectField`.

Keys supplied by the page through `create.input` are **hidden** from the form and merged into the
submit. `prefill` with no `from` seeds the form on mount from the endpoint's Output by matching
field names; a prefill whose `input` binds `$form.*` cannot run on mount (the form is still empty),
so the renderer offers it as an explicit action instead — **derived from the spec, not declared**
`sdk/org/libs/ui/src/view/sections/create.tsx#bindsForm`. `merge: 'fill-empty'` is the only policy
in v1 `sdk/org/libs/ui/src/view/form.tsx#mergeFillEmpty`. Validation is not duplicated:
required-ness gates the submit button and everything else is ajv's job on the pod, whose
`{ error }` body the section shows `sdk/org/libs/ui/src/view/form.tsx#isComplete`.

## The element catalogue, and the two modifiers

24 elements, drawn from `Prim.*` and the `elements/*` catalogue
`sdk/org/libs/ui/src/view/elements.tsx#renderElement`. Prop names follow the descriptor renderer
(`sdk/org/libs/ui/src/chat/components/render-descriptor.tsx#renderDescriptor`) wherever it already
has the element; the deliberate divergences are that a spec has one finite **`tone`** where that
renderer takes a free-string `color`, and that list-shaped props carry **bindings** rather than
pre-materialised data, because a spec is authored before the data exists.

- **`format`** is a modifier on any bound value, absorbing the `format.ts` all five catalogue apps
  hand-write. `Intl` is used where it exists and every helper degrades to the plain value, because
  a throw inside a formatter would take down a page for a currency symbol
  `sdk/org/libs/ui/src/view/format.ts#applyFormat`. `currencyField` names the row field holding
  the ISO code, which the two multi-currency apps need `sdk/org/libs/ui/src/view/format.ts#formatBound`.
- **`tone` is never a colour** — it maps to a design token, which is why a spec structurally cannot
  violate the design system `sdk/org/libs/ui/src/view/format.ts#TONE_TOKENS`. **`toneMap` is the
  load-bearing half**: `tone: 'auto'` cannot know that `self_care` is good news and `emergency` is
  not, so the model declares a lookup table — a third of the corpus gets conditional colour without
  the language gaining conditionals `sdk/org/libs/ui/src/view/format.ts#resolveTone`. A declared
  map wins over a literal tone; `auto`'s own vocabulary is kept deliberately small
  `sdk/org/libs/ui/src/view/format.ts#autoTone`.
- **`maxLines`** clamps with an ellipsis on both targets (RN's `numberOfLines` and the web
  line-clamp trio) `sdk/org/libs/ui/src/view/elements.tsx#clampProps`; **`strike`** and the other
  leaf props ride on `text` `sdk/org/libs/ui/src/view/types.ts#TextEl`.
- **`field`** is the one element the audit added, and the one finding that was outright
  inexpressible: `button { mutate }` carries no argument, so without it a spec app renders every
  page and lets a user change nothing about a row. The new control value is sent under the Input
  key named by `arg`, defaulting to the last segment of `value`'s path
  `sdk/org/libs/ui/src/view/elements.tsx#FieldElement`, `sdk/org/libs/ui/src/view/bind.ts#lastSegment`.

## Native-first — what that costs and what it buys

The renderer is built on `Prim.*` so one definition draws on both targets. Three native traps are
designed around rather than discovered later:

- **Icons are SVG primitives, never lucide** (which renders a DOM `<svg>` and mounts nothing on a
  device). The set is finite by design — 32 names — and an unknown name draws a visible fallback
  glyph rather than a silent blank `sdk/org/libs/ui/src/view/icons.tsx#ViewIcon`,
  `sdk/org/libs/ui/src/view/types.ts#ICON_NAMES`.
- **Every string sits inside a `Prim.Text`.** React Native refuses a bare string in a View and then
  *drops* it, so a label vanishes rather than erroring — and neither jsdom nor
  `react-test-renderer` enforces the rule, which is why the native suite sweeps the whole mounted
  tree for loose strings `sdk/org/libs/ui/metro/suites/view.tsx:36-45`.
- **Yoga has no overflow scrolling**, so `scroll: 'x'` on `row`/`grid`/`table` is native
  *correctness*, not cosmetics: without a real scrolling host a wide table or a week grid is
  clipped with no gesture to reach the rest. `primitives/scroll` is vertical and forwards nothing
  that would make it horizontal, so the renderer carries its own one-file-per-host translation
  `sdk/org/libs/ui/src/view/hscroll.tsx#HScroll`,
  `sdk/org/libs/ui/src/view/hscroll.native.tsx#HScroll`. It is the renderer's **only** fork.
- The selects and toggles are drawn rather than delegated, because `Prim.Select`'s native fork is
  an inert placeholder (`sdk/org/libs/ui/src/elements/primitives/controls.native.tsx:88-95`) — a
  real `<select>` would leave every derived form unusable on a phone
  `sdk/org/libs/ui/src/view/controls.tsx#SelectControl`.

**A jsdom test cannot see any of this** (`isWeb` is always true there), so the claims are split:
`src/view/**/*.test.*` covers behaviour — the lifecycle, S1, dispatch, dependent queries — and
`metro/suites/view.tsx` covers *mounting*, on ios and android, through the real reconciler
`sdk/org/libs/ui/metro/suites/view.tsx:1-22`. The view surface is on the resolution gate's entry
(`sdk/org/libs/ui/metro/entries/surface.ts:40-45`) and its fork is in the gate's expected list
`sdk/org/libs/ui/metro/graph-gate.mjs:74-79`.

```bash
pnpm --filter @lmthing/ui test         # jsdom — behaviour
pnpm test:native                       # metro graph gate + render suites, ios AND android
```
