# `components/` — agent-rendered UI

A space's `components/` directory holds single-file React (`.tsx`/`.ts`) components that an **agent** renders into the conversation — either fire-and-forget with `display()` or interactively with `ask()`. It is loaded from `<space>/components/` by `loadComponents`, which populates two maps, `view` and `form` `sdk/org/libs/core/src/spaces/load.ts#loadComponents`.

These are **distinct from a project's `components/`** ([`../../project/components/`](../../project/components)): space components are model-facing chat UI resolved by the runtime, not React modules imported by an app's `pages/`.

## Two kinds: `view/` vs `form/`

- **`view/<Name>.tsx`** — display components. Each `.tsx`/`.ts` file under `components/view/` becomes one entry keyed by its basename `sdk/org/libs/core/src/spaces/load.ts:217-228`. The system prompt advertises them for use with `display()`, e.g. `<ArticlePreview … />` `sdk/org/libs/core/src/context/system-block.ts:323-327`.
- **`form/<Name>.tsx`** — interactive inputs. Each `.tsx`/`.ts` file under `components/form/` becomes one entry `sdk/org/libs/core/src/spaces/load.ts:234-250`; the legacy `<Name>/{web,ink}.tsx` directory split is read defensively (prefer `web.tsx`, else `ink.tsx`) only for not-yet-migrated on-disk spaces `sdk/org/libs/core/src/spaces/load.ts:242-248`. Form components are advertised for use with `ask()`, e.g. `await ask(<Name … />)` `sdk/org/libs/core/src/context/system-block.ts:331-334`.

`display(descriptor)` is fire-and-forget: it pushes the descriptor to the render surface and does **not** yield or end the turn `sdk/org/libs/core/src/globals/display.ts#createDisplayGlobal`. `ask(descriptor)` validates the descriptor, pushes an `ask` yield, and returns a `Promise` that resolves when the surface submits a value `sdk/org/libs/core/src/globals/ask.ts#createAskGlobal`. `ask()` blocks dangerous descriptor types (`script`/`iframe`/`object`/`embed`/`frame`/`frameset`), `dangerouslySetInnerHTML`, and `javascript:` URLs, recursing into children `sdk/org/libs/core/src/globals/ask.ts:8-58`. Detail on each kind → [`view.md`](./view.md) · [`form.md`](./form.md).

## Referenced by the agent's `components:` frontmatter

A component is only surfaced to an agent if the agent lists it in its `components:` frontmatter — an allowed agent frontmatter key `sdk/org/libs/core/src/spaces/load.ts#AGENT_FRONTMATTER_ALLOWED_KEYS` parsed into `config.components` `sdk/org/libs/core/src/spaces/load.ts:63`. At turn build, `getAgentComponents` returns only the named components, routing each into the `view` or `form` result depending on which catalog it lives in `sdk/org/libs/core/src/spaces/components.ts#getAgentComponents`. See [`../agents/frontmatter.md`](../agents/frontmatter.md).

Form components are omitted entirely from the prompt for autonomous (delegated/headless) agents that have no `ask()` `sdk/org/libs/core/src/context/system-block.ts:328-336`.

## Built from the shared catalog + design tokens

Components use only `@lmthing/css` design tokens for styling — never raw colors. Real view components style with token utilities like `bg-card`, `text-foreground`, `border-border`, and `text-muted-foreground` `store/projects/blog/spaces/newsroom/components/view/ArticlePreview.tsx#ArticlePreview`; status variants map to tokens like `bg-primary text-primary-foreground` and `text-destructive` rather than literal colors `store/projects/blog/spaces/research/components/view/BriefingPreview.tsx#STATUS_STYLES`.

## Worked example

A real `view/` component (from the `newsroom` space in the `blog` catalog app) — the leading JSDoc becomes the component's description in the agent prompt, and every prop is token-styled:

```tsx
import React from 'react';

/**
 * A small catalog display for a synthesized article — shown in chat while the synthesizer is
 * discussing or has just written it up, before/alongside it appearing in the main feed.
 */
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
      {/* … token-styled tag pills … */}
    </div>
  );
}

export default ArticlePreview;
```

The `synthesizer` agent opts into it via frontmatter (`components: [ArticlePreview]`) `store/projects/blog/spaces/newsroom/agents/synthesizer/instruct.md:14-15`, and the runtime then advertises `display(<ArticlePreview … />)` in that agent's system prompt `sdk/org/libs/core/src/context/system-block.ts:323-327`.

Source: `store/projects/blog/spaces/newsroom/components/view/ArticlePreview.tsx`.

## See also

- [`view.md`](./view.md) — display components + `display()`.
- [`form.md`](./form.md) — interactive components + `ask()`.
- [`../agents/frontmatter.md`](../agents/frontmatter.md) — the `components:` allow-list key.
- [`../../project/components/`](../../project/components) — a project's own React components (distinct).
