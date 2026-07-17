# The `_app.tsx` special file

`_app.tsx` is an optional root **wrapper** under a project's `pages/` directory: it wraps every route in the app, and is not itself a route (`sdk/org/libs/cli/src/app/build/pages.ts:11-13`). It is one of exactly two recognized wrapper basenames, `_app` and `_layout` (`sdk/org/libs/cli/src/app/build/pages.ts:151-152`). For the surrounding page conventions see [`project/pages/README.md`](./README.md); for the sibling wrapper see [`project/pages/layout-file.md`](./layout-file.md).

## Not a route

During route discovery the page builder skips any file whose basename starts with `_`, so `_app.tsx` (and `_layout.tsx`) never become routes (`sdk/org/libs/cli/src/app/build/pages.ts#walkPages,179`). The wrapper files are instead located separately by `findWrappers`, which probes for `_app.{tsx,jsx}` and `_layout.{tsx,jsx}` in the `pages/` directory (`sdk/org/libs/cli/src/app/build/pages.ts#findWrappers`).

## Default-export a `{ children }` component

`_app.tsx` must default-export a React component that receives `{ children }`; the wrapper type is `React.ComponentType<{ children: React.ReactNode }>` (`sdk/org/libs/cli/src/app/build/pages.ts:20-21`). The generated client entry imports it as the default export (`import App from '<_app path>'`) and passes it as `app` to `mountApp` (`sdk/org/libs/cli/src/app/build/pages.ts#renderEntry,337`). Its purpose is app-wide providers / context — the `_app.tsx` root wrapper (`sdk/org/libs/cli/src/app/build/pages.ts:37`).

## How it wraps every route

At runtime the router renders the matched page nested inside `_layout` inside `_app`: `wrap(app, layout, page)` applies `Layout` first, then `App` outermost, so `<App><Layout>{page}</Layout></App>` (`sdk/org/libs/cli/src/app/runtime/router.tsx#wrap`). `AppRoot` calls `wrap(app, layout, page)` for whichever route currently matches, meaning the same `App` instance surrounds every route (`sdk/org/libs/cli/src/app/runtime/router.tsx#AppRoot`).

## Behavior when omitted

`_app.tsx` is optional (`sdk/org/libs/cli/src/app/build/pages.ts:37`). If no `_app.{tsx,jsx}` exists, `findWrappers` leaves `app` undefined (`sdk/org/libs/cli/src/app/build/pages.ts#findWrappers`), the generated entry passes `app: null` to `mountApp` (`sdk/org/libs/cli/src/app/build/pages.ts#renderEntry`), and `wrap` skips the `App` layer entirely (`if (App) node = <App>{node}</App>` only runs when truthy) — pages render without an app-level wrapper (`sdk/org/libs/cli/src/app/runtime/router.tsx#wrap`).

## Worked example

Adapted from `store/projects/blog/pages/_app.tsx` — the minimal pass-through wrapper:

```tsx
import React from 'react';

export default function App({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

`store/projects/blog/pages/_app.tsx:1-5`
