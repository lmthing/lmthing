# `components/<Name>.tsx` — the project-app's shared React library

`components/` is a project-root directory (a sibling of `pages/ api/ hooks/ database/`) that the app scaffolder creates alongside the other app dirs (`sdk/org/libs/cli/src/app/authoring/globals.ts:160` lists `'components'` among the app dirs). It holds plain React components (cards, rows, skeletons, empty states, formatters) imported by the app's [pages](../pages/README.md) — the project-app's own presentation library, distinct from a **space's** agent-rendered `components/{view,form}` (see [../../space/components/README.md](../../space/components/README.md)).

## Not file-routed; one typed live-project writer

Unlike pages, components are **not** discovered as routes: the page-build route walker skips any `components/`/`lib/` directory and any `_`-prefixed file (`sdk/org/libs/cli/src/app/build/pages.ts:172-173`, comment "hold shared code, not routes"). Only non-`_`-prefixed `.tsx`/`.jsx` files under `pages/` become routes (`sdk/org/libs/cli/src/app/build/pages.ts:11-12`).

There is **no *catalog* component writer** — the catalog authoring surface targeting `store/projects/<id>/` exposes only `writePage`/`writeApi`/`writeHook`/`writeTableSchema` (`sdk/org/libs/cli/src/app/authoring/globals.ts:197,210,223,243`), none of which touches `components/`. But the **live project** does have a typed shared-component writer: **`writeProjectComponent(name, src)`** writes `<projectRoot>/components/<Name>.tsx` and rebuilds the served app so a page can import it (`sdk/org/libs/cli/src/app/authoring/globals.ts:496-514`); the `<Name>` is **PascalCase** and `.tsx` is enforced (`COMPONENT_NAME_RE` at `sdk/org/libs/cli/src/app/authoring/globals.ts:75`). It is declared in the model DTS as `PROJECT_COMPONENT_DTS` (`sdk/org/libs/core/src/typecheck/library-dts.ts:219`) and earned by the **`pages:write`** capability, injected on the `pages:write` grant of a project-rooted session (`sdk/org/libs/core/src/exec/app-globals.ts:219`) — it is the typed surface for shared UI now that the space-rooted fs writers are gone. A component may still also be an ordinary source file imported by the generated pages.

## Imported by pages via a relative path

Pages pull components in by relative path — e.g. `import { InsightsPanel } from '../components/InsightsPanel'` (`store/projects/blog/pages/insights.tsx:3`) and `import { MarkdownBody } from '../../components/MarkdownBody'` from a nested page (`store/projects/blog/pages/briefings/[briefingId].tsx:4`). Components freely import each other (`ArticleCard` imports `./icons`, `./format`, `./RelevanceMeter` — `store/projects/blog/components/ArticleCard.tsx:4-6`) and may import DB-derived row types from the generated `@app/types` module (`import type { Article } from '@app/types'` — `store/projects/blog/components/ArticleCard.tsx:2`), which is `types/generated.d.ts` produced from `database/*.json` (`sdk/org/libs/cli/src/app/build/schema.ts` `generateAppTypes`). Components may also use `@app/runtime` client helpers such as `Link` (`store/projects/blog/components/ArticleCard.tsx:3`). A sibling may be a plain non-component `.ts` helper module too (`store/projects/blog/components/format.ts:1-4`, pure formatting functions, no JSX).

## Design tokens only

Components must style with **design tokens only** — no raw hex/`rgb()`/`hsl()` and no stock Tailwind color utilities (`gray-*`/`blue-*`/`green-500`), the same rule every lmthing surface follows (root `CLAUDE.md` design-system section; canonical spec `sdk/org/libs/css/DESIGN.md`). Real components obey this: `EmptyState` uses only `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `border-destructive` (`store/projects/blog/components/EmptyState.tsx:26-77`), and `StatsStrip` uses `bg-card`/`border-border`/`text-primary` (`store/projects/blog/components/StatsStrip.tsx:14-43`).

> UNVERIFIED: whether project-app components are enforced by a token linter. The repo `pnpm lint:tokens` gate does NOT scan `store/projects/` or pod project roots — its path list is `sdk/org/libs/css/src … apps/web/src com/src social/src team/src store/src space/src blog/src casa/src` (`package.json:14`), which covers `store/src` but not `store/projects/`. I found no automated token-lint step in the pod app build (`sdk/org/libs/cli/src/app` has only inline "no raw colors" comments in `runtime/chat.tsx`/`router.tsx`). So for project-app components tokens-only is a design-system mandate rather than an enforced CI check.

## What a real one looks like

Adapted from `store/projects/blog/components/EmptyState.tsx:10-53` (tokens only, `@app/runtime` `Link`):

```tsx
import React from 'react';
import { Link } from '@app/runtime';

export function EmptyState({
  title,
  message,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
```

## See also

- [../pages/README.md](../pages/README.md) — the file-routed pages that import these components.
- [../../space/components/README.md](../../space/components/README.md) — the different, agent-rendered space `components/{view,form}`.

Real examples live in every catalog app's `components/` dir — e.g. `store/projects/blog/components/` (`ArticleCard.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `StatsStrip.tsx`, `icons.tsx`, `format.ts`, …).
