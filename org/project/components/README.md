# `components/<Name>.tsx` — shared React components

Plain React components imported by the app's [pages/](../pages/). This is the project-app's own
component library (cards, rows, skeletons, empty states, formatters) — distinct from a **space's**
agent-rendered `components/{view,form}` ([../../space/components/](../../space/components/)).

## Format

A `.tsx` module exporting one or more components. Style with **design tokens only** — the same hard
gate as pages.

```tsx
import React from 'react';
import type { Article } from '@app/types';

export function ArticleCard({ article, onRead }: { article: Article; onRead: (id: string) => void }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground">{article.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
    </article>
  );
}
```

## Notes

- Imported by pages via a relative path (`import { ArticleCard } from '../components/ArticleCard'`).
- Free to import DB-derived types from `@app/types` and helpers from sibling components.
- **No raw colors** — tokens only (`bg-card`, `text-foreground`, `border-border`, …). Enforced by
  `pnpm lint:tokens` + CI.
- Not file-routed and not written by a dedicated authoring global — they're ordinary source files
  the app-builder writes alongside pages.

Real examples: `store/projects/blog/components/` (`ArticleCard.tsx`, `EmptyState.tsx`,
`Skeleton.tsx`, `StatsStrip.tsx`, …).
