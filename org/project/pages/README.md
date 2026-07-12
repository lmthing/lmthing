# `pages/<route>.tsx` — client-side React route

File-routed client pages. Written by `writePage(route, src)` (granted by `pages:write`). `route`
is `index` (root) or a path like `feed/[articleId]` — a `[seg]` is a dynamic param read via
`useParams`.

```
pages/index.tsx                →  /
pages/feed/[articleId].tsx     →  /feed/:articleId
pages/feed/[articleId]/research.tsx  →  /feed/:articleId/research
```

**Special files:** `_app.tsx` (root wrapper) and `_layout.tsx` (shared layout).

## Format

Default-export a component; pull data from `@app/runtime`:

```tsx
import React, { useState } from 'react';
import type { Article } from '@app/types';                     // generated from db schemas
import { useApi, useApiMutation, apiCall, Link, navigate } from '@app/runtime';
import { ArticleCard } from '../components/ArticleCard';

export default function Feed() {
  const { data: articles, isLoading, error, refetch } = useApi<Article[]>('feedList', {});
  const markAllRead = useApiMutation<{ count: number }>('markAllRead', { invalidates: ['feedList'] });
  // …render with design tokens ONLY (see the design-system gate)
}
```

The minimal `_app.tsx` is just a pass-through wrapper:

```tsx
import React from 'react';
export default function App({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

## `@app/runtime` data hooks

| API | Verbs | Returns |
|---|---|---|
| `useApi(name, input?, opts?)` | GET / DELETE reads | `{ data, error, isLoading, refetch }` |
| `useApiMutation(name, { invalidates? })` | POST / PATCH / PUT | `{ mutate }` |
| `apiCall(name, input)` | imperative one-shot call | `Promise<Output>` |
| `Link`, `navigate`, `useParams` | routing | — |

`name` is the endpoint's exported `name` (see [../api/](../api/)); `invalidates` lists query keys
to refetch after a mutation.

## Styling — a hard gate

> **No raw colors anywhere** — only design tokens (`var(--foreground)`, `bg-primary`,
> `text-agent`, …). No hex, no literal `rgb()/hsl()`, no stock Tailwind colors (`gray-*`,
> `blue-500`). Enforced by `pnpm lint:tokens` + CI. Shared components live in
> [../components/](../components/).

Real example: `store/projects/blog/pages/index.tsx` (and `pages/_app.tsx`).
