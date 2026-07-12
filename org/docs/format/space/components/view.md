# View component — `components/view/<Name>.tsx`

A **view component** is a single React TSX file that an agent renders to the chat/UI surface by passing it as a JSX descriptor to the `display()` global `sdk/org/libs/core/src/globals/display.ts:15`. It is a *display-only* component — for interactive input collection use a [form component](./form.md) presented via `ask()` instead `org/space/components/README.md`.

## Loading

View components live under `components/view/` in a space `sdk/org/libs/core/src/spaces/load.ts:218`. `loadComponents` walks that directory and registers every `.tsx`/`.ts` file under `space.components.view`, keyed by the file's basename (without extension) `sdk/org/libs/core/src/spaces/load.ts:220-227`. If `components/` does not exist the space simply has no components `sdk/org/libs/core/src/spaces/load.ts:213-215`.

A component is available to an agent only if its name is listed in that agent's `components:` frontmatter `sdk/org/libs/core/src/spaces/load.ts` `loadAgent`. `getAgentComponents` filters the space's registered components down to exactly the names in `agent.config.components`, splitting them into `view` and `form` maps `sdk/org/libs/core/src/spaces/components.ts:16-22`. A name that resolves to `space.components.view` is offered to the agent as a view component `sdk/org/libs/core/src/spaces/components.ts:17-18`.

## Rendering via `display()`

`display(descriptor)` is a fire-and-forget global: it pushes the descriptor to the render surface (`renderHost.display`) without triggering a yield or ending the turn `sdk/org/libs/core/src/globals/display.ts:3-24`. Number/boolean/bigint descriptors are coerced to strings so `display(count)` works, while objects and JSX descriptors pass through unchanged `sdk/org/libs/core/src/globals/display.ts:16-22`. The host consumes the descriptor through the `RenderHost.display(descriptor: unknown): void` interface `sdk/org/libs/core/src/session/types.ts:11`.

## Design tokens only

View components are built from the shared catalog and `@lmthing/css` design tokens; **no raw colors** are permitted — use token utilities like `bg-card`, `text-foreground`, `border-border` `org/space/components/README.md`. This is the repo-wide hard gate enforced by `pnpm lint:tokens` and CI `CLAUDE.md`.

## Worked example

Adapted from the real `newsroom` space's `ArticlePreview` view component `store/projects/blog/spaces/newsroom/components/view/ArticlePreview.tsx:7-31`, a token-only display of a synthesized article:

```tsx
import React from 'react';

/** A small catalog display for a synthesized article, shown in chat. */
export function ArticlePreview({
  title,
  summary,
  tags,
}: {
  title: string;
  summary?: string;
  tags?: string[];
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
      {tags && tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ArticlePreview;
```

The `synthesizer` agent lists `ArticlePreview` under its `components:` frontmatter `store/projects/blog/spaces/newsroom/agents/synthesizer/instruct.md:14-15` and its instructions describe it as "the catalog component that renders this article's `title`/`summary`/`tags` in chat" `store/projects/blog/spaces/newsroom/agents/synthesizer/instruct.md:61-62`.

> UNVERIFIED: I did not find an explicit `display(<ArticlePreview .../>)` call site in the on-disk `newsroom` instruct files (searched `rg 'display\('` under `store/projects/blog/spaces/newsroom/`); the instruct prose describes the component being rendered but the concrete `display()` invocation is left to the model at runtime.

## See also

- [`form/<Name>.tsx`](./form.md) — interactive input components presented via `ask()`.
- [`components/` overview](./README.md) — view vs. form, referencing from agent frontmatter.
