# App views — the client layer of a project-app

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

A view addresses an endpoint by its stable exported `name` (`export const name = 'markRead'` in the handler — see [../format/project/api/README.md](../format/project/api/README.md)); the network layer addresses it by route. The bridge is the **endpoint manifest** `name → { method, routePath }`, projected at build time from the typed `EndpointContract[]` `sdk/org/libs/cli/src/app/build/pages.ts#endpointManifest` and injected onto `window.__APP_ENDPOINTS__` by `mountApp` `sdk/org/libs/cli/src/app/runtime/router.tsx#mountApp`. `apiCall` reads that manifest, and throws `HttpError(500, 'unknown endpoint "<name>"')` for an unknown name (or a 500 if the manifest was never injected) `sdk/org/libs/cli/src/app/runtime/client.ts#manifest`, `sdk/org/libs/cli/src/app/runtime/client.ts#apiCall`.

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

For views the rule is an **authoring mandate, not an automated gate**. The linter walks only the roots it is handed on argv `sdk/org/libs/css/scripts/lint-design-tokens.mjs:75-90`, and both the root `pnpm lint:tokens` script and the CI job pass the same SPA source trees — `sdk/org/libs/{css,ui}/src`, `sdk/org/apps/web/src`, `com/src social/src team/src store/src space/src blog/src casa/src`, `org/src` — never `store/projects/` or a pod project root `package.json:14`, `.github/workflows/design-tokens.yml:39-43`. (The workflow *triggers* on `store/**`, so touching a shipped project app runs the job — it just never lints that app's pages `.github/workflows/design-tokens.yml:6-27`.) The page build has no color-lint step either `sdk/org/libs/cli/src/app/build/pages.ts`. What actually holds the line for generated apps is the appbuilder prompt: the automator agent and its `implement_pages` tasklist step both mandate tokens only — "never a raw hex, `rgb()/hsl()`, or a stock Tailwind color" `sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md:36-42`, `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/15-implement_pages.md:40-41`.

## Gotchas

- **`mountApp` is not a page API.** It is called only by the entry the build generates in `<projectRoot>/.data/pages-build/entry.tsx`, which imports the pages + `_app`/`_layout`, embeds the route table and manifest, and mounts `AppRoot` `sdk/org/libs/cli/src/app/build/pages.ts#renderEntry`.
- **Runtime-only fixes need `BUILDER_VERSION` bumped.** The build cache hashes only the project's own `pages/`/`components/`/`lib/`/`package.json`; a change to `@app/runtime` reaches already-built apps only when `BUILDER_VERSION` (currently `'7'`) changes `sdk/org/libs/cli/src/app/build/pages.ts#BUILDER_VERSION`.
- **Views are built, not rendered per request.** The page server only reads a cached `{ outDir, assetManifest }`; a path not in the manifest falls back to `index.html`, which is what makes dotted dynamic params route client-side `sdk/org/libs/cli/src/app/pages-serve.ts:1-46`.
- **Inline `<script>` is blocked.** Served pages carry a strict CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; …`), with a per-response nonce only for the `__APP_BASE__` bootstrap — so LLM-authored view content cannot inject executable script `sdk/org/libs/cli/src/app/pages-serve.ts#CSP`, `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`.
