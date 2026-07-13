# The `_layout.tsx` special file

`_layout.tsx` (or `_layout.jsx`) is one of the two **wrapper** special files under a project's `pages/` — it is not a route, it is persistent chrome that wraps every rendered page `sdk/org/libs/cli/src/app/build/pages.ts#WRAPPERS`. See [`pages/README.md`](./README.md) for the file-based router as a whole and [`pages/app-file.md`](./app-file.md) for its sibling `_app.tsx`.

## Not a route

Route discovery walks `pages/` and treats every non-`_`-prefixed `.tsx`/`.jsx` as a route, but any basename starting with `_` is skipped `sdk/org/libs/cli/src/app/build/pages.ts#walkPages`. `_app` and `_layout` are the two recognized wrapper basenames and are explicitly excluded from the route table `sdk/org/libs/cli/src/app/build/pages.ts#WRAPPERS`. So a `_layout.tsx` file never becomes a navigable URL.

## Default-export a component

`_layout.tsx` must **default-export** a React component — the generated build entry imports it as a default (`import Layout from '…/_layout.tsx'`) `sdk/org/libs/cli/src/app/build/pages.ts#renderEntry`. The component receives the wrapped content as `children` (the router's `WrapperComponent` type is `React.ComponentType<{ children: React.ReactNode }>`) `sdk/org/libs/cli/src/app/runtime/router.tsx#WrapperComponent`.

## Detection is optional and root-only

`findWrappers` looks only at the **top of `pages/`** for `_layout.tsx`/`_layout.jsx` `sdk/org/libs/cli/src/app/build/pages.ts#findWrappers`. If none exists, the build passes `layout: null` and the router simply renders pages without a layout wrapper `sdk/org/libs/cli/src/app/build/pages.ts#renderEntry`. There is no per-directory / per-segment nested-layout discovery — a `_layout` in a subdirectory is skipped as a `_`-prefixed file `sdk/org/libs/cli/src/app/build/pages.ts#walkPages` and is never mounted; a single root `_layout.tsx` wraps **every** route regardless of its segment depth `sdk/org/libs/cli/src/app/runtime/router.tsx#AppRoot`.

## Nesting: `_app` outside, `_layout` inside, page innermost

The router's `wrap` composes the tree so that `_layout` wraps the page and `_app` wraps `_layout` (`node = <Layout>{node}</Layout>` then `node = <App>{node}</App>`) `sdk/org/libs/cli/src/app/runtime/router.tsx#wrap`. Both wrappers are optional and independent. The distinction versus [`_app.tsx`](./app-file.md): `_app` is the outermost root wrapper for providers/context, while `_layout` is the persistent chrome (nav, header) that sits between it and the page `sdk/org/libs/cli/src/app/runtime/router.tsx#MountConfig`.

Because the layout instance persists across client-side navigations (the router only re-renders the matched page under the same `AppRoot` on the History-nav event) `sdk/org/libs/cli/src/app/runtime/router.tsx#AppRoot`, layout-local state (open menus, scroll) survives route changes.

## What a real one looks like

Adapted from the shipped example `store/projects/blog/pages/_layout.tsx#viewTitle` — default-exported, typed `{ children }`, renders `children` inside persistent nav chrome:

```tsx
import React from 'react';
import { Link, useApi } from '@app/runtime';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: alerts } = useApi<Alert[]>('listAlerts', { unreadOnly: true });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 border-b border-border bg-card">
        <Link href="/">lmthing<span className="text-primary">.blog</span></Link>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

The example uses `@app/runtime`'s `Link`/`useApi` and design-system tokens (`bg-background`, `text-primary`) `store/projects/blog/pages/_layout.tsx:2`; navigation via `Link` stays client-side and re-applies the app base `sdk/org/libs/cli/src/app/runtime/router.tsx#Link`.

## Build & caching notes

`_layout.tsx` changes are picked up because the page bundle's content hash covers every file under `pages/` `sdk/org/libs/cli/src/app/build/pages.ts#sourceHash`; the bundle is rebuilt on save/boot, never per request `sdk/org/libs/cli/src/app/build/pages.ts:6-8`.
