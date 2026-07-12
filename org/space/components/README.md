# `components/{view,form}/<Name>.tsx` — agent-rendered UI

Single TSX files built from the shared catalog + design tokens, rendered by an agent (not
imported by app pages — that's the project's [components/](../../project/components/)). Referenced
from an agent's `components:` frontmatter (see [../agents/](../agents/)).

- **`view/<Name>.tsx`** — display components, rendered via the `display()` global.
- **`form/<Name>.tsx`** — interactive inputs, presented via the `ask()` global (the old
  `web.tsx`/`ink.tsx` two-file split has been removed — a form is a single TSX file, exactly like a
  view component).

## Format

```tsx
import React from 'react';

/** A small catalog display for a synthesized article, shown in chat. */
export function ArticlePreview({ title, summary, tags }: { title: string; summary?: string; tags?: string[] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
    </div>
  );
}
export default ArticlePreview;
```

## Notes

- Built from the shared component catalog + `@lmthing/css` design tokens. **No raw colors** — tokens
  only (`bg-card`, `text-foreground`, `border-border`, …).
- `view/` components are for showing data; `form/` components collect input and return it to the
  agent turn that called `ask()`.

Real examples: `store/projects/blog/spaces/newsroom/components/view/ArticlePreview.tsx`,
`.../research/components/view/BriefingPreview.tsx`.
