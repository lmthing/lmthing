# Form component — `components/form/<Name>.tsx`

A **form component** is a single React TSX file that an agent presents to the human by passing it as a JSX descriptor to the `ask()` global `sdk/org/libs/core/src/globals/ask.ts:64-92`. Where a [view component](./view.md) only displays data via `display()`, a form component *collects input* — `ask()` pauses the turn, the render surface shows the form, and the collected value is returned to the calling turn `sdk/org/libs/core/src/globals/ask.ts:82-90`.

## A single TSX file (the `web.tsx`/`ink.tsx` split is gone)

A form component is one `<Name>.tsx` file, exactly like a view component — the former `<Name>/{web,ink}.tsx` two-file split has been removed. `loadComponents` reads each `.tsx`/`.ts` entry directly under `components/form/` into `space.components.form`, keyed by the file's basename `sdk/org/libs/core/src/spaces/load.ts:229-242`. A directory entry still holding the legacy `web.tsx`/`ink.tsx` layout is read defensively (preferring `web.tsx`, else `ink.tsx`) so not-yet-migrated on-disk spaces keep loading, but the canonical shape is a single file `sdk/org/libs/core/src/spaces/load.ts:243-249`.

## Availability to an agent

A form component is offered to an agent only if its name appears in that agent's `components:` frontmatter `sdk/org/libs/core/src/spaces/components.ts:6-24`. `getAgentComponents` filters the space's registered components to the names in `agent.config.components`; a name found in `space.components.form` is returned in the `form` map `sdk/org/libs/core/src/spaces/components.ts:16-22`. The typecheck overlay declares every referenced component (view and form are treated identically now — both single-file sources) as `declare function <Name>(props: <Name>Props): JSXDescriptor`, extracting the `Props` interface from the source (falling back to `Record<string, unknown>`) so `ask(<NameForm .../>)` typechecks `sdk/org/libs/core/src/typecheck/overlay.ts:80-92`.

## Presented via `ask()`

`ask(descriptor)` validates the descriptor, pushes a single `{kind:'ask'}` yield, and returns a `Promise` that resolves when the render surface submits a value `sdk/org/libs/core/src/globals/ask.ts:69-91`. Validation is security-oriented: it rejects a non-descriptor argument, blocks dangerous element types (`script`/`iframe`/`object`/`embed`/`frame`/`frameset`), forbids `dangerouslySetInnerHTML`, and rejects `javascript:` URLs in any prop — recursively over children `sdk/org/libs/core/src/globals/ask.ts:8-58`. The yield carries `[id, descriptor]`; the session handles `kind:'ask'` by calling `renderHost.ask(id, descriptor)` and awaiting the user's input `sdk/org/libs/core/src/session/session.ts:797-800`. The `RenderHost.ask(id, descriptor)` interface returns `Promise<unknown>` — the collected value `sdk/org/libs/core/src/session/types.ts:12`.

`ask` is **top-level-session-only**: it is not injected into forks or delegates (they are headless/autonomous) and is absent from their DTS (`LIBRARY_DTS_NO_ASK`), so a stray `ask()` in a task or delegate fails typecheck `sdk/org/libs/core/src/typecheck/library-dts.ts:8-9`, `sdk/org/libs/core/src/typecheck/library-dts.test.ts:37-40`. The `ask` DTS signature accepts a JSX descriptor or a bare string `sdk/org/libs/core/src/typecheck/library-dts.ts:14`.

## Built from the catalog; returns the collected input

A form component is assembled from the shared **form catalog** — `TextField`, `TextArea`, `Select`, `MultiSelect`, `Checkbox`, `Slider`, `ConfirmButtons`, and the `Form`/`Fieldset`/`Field` wrappers, among others `sdk/org/libs/core/src/ui/catalog.ts:86-120`. When the form is submitted, the descriptor is flattened to a `FormSpec` by `flattenForm`: a bare single control (`single: true`) resolves `ask()` with a bare value, while a `Form`/`Fieldset` wrapper resolves with an object keyed by each field's `name` `sdk/org/libs/core/src/ui/form.ts:142-152`. Field wrapper `label`/`help` flow onto the inner control, and unnamed fields are auto-named `sdk/org/libs/core/src/ui/form.test.ts:44-66`. Raw control values are coerced to typed values per field kind (numbers parsed, checkboxes to boolean, tag/multi inputs to arrays) `sdk/org/libs/core/src/ui/form.ts:154-170`. The web and terminal renderers share this flatten/coerce path so `ask(<Form>…</Form>)` behaves identically on both surfaces `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx:1-11`.

## Design tokens only

Like view components, form components are built from the shared catalog + `@lmthing/css` design tokens; **no raw colors** are permitted — use token utilities (`bg-card`, `text-foreground`, `border-border`, …) `org/space/components/README.md`. This is the repo-wide hard gate enforced by `pnpm lint:tokens` and CI `CLAUDE.md`.

## Worked example

There is no on-disk `components/form/<Name>.tsx` in the current repo to copy verbatim (all shipped example spaces use only `components/view/`); the example below is assembled from the real catalog form components `sdk/org/libs/core/src/ui/catalog.ts:86-120` following the same single-TSX pattern as the [view example](./view.md), and its multi-field submit shape mirrors the real `Form` descriptor exercised in `sdk/org/libs/core/src/ui/form.test.ts:44-58`:

> UNVERIFIED: searched `find … -path '*components/form/*.tsx'` under `store/`, `.lmthing/`, and `sdk/org/system-spaces/` — no space form-component `.tsx` file exists in the working tree (only a `TaskInput.tsx` inside a detached git worktree). The example is therefore adapted from the catalog, not copied from a shipped space form component.

```tsx
import React from 'react';

/** Collects an article's title/summary/urgency. ask() resolves with
 *  { title, summary, urgent } — one object keyed by each field's name. */
export default function ArticleForm() {
  return (
    <Form submitLabel="Save">
      <TextField name="title" label="Title" />
      <Field label="Summary" help="one or two sentences">
        <TextArea name="summary" rows={3} />
      </Field>
      <Checkbox name="urgent" label="Publish immediately" />
    </Form>
  );
}
```

The agent lists `ArticleForm` in its `components:` frontmatter, then `const article = await ask(<ArticleForm />)` — the resolved `article` is the keyed object described above `sdk/org/libs/core/src/ui/form.ts:142-152`.

## See also

- [`components/view/<Name>.tsx`](./view.md) — the display-only sibling, rendered via `display()`.
- [`components/{view,form}/` overview](./README.md) — where both kinds live and how they are referenced.
