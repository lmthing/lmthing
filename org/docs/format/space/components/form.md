# Form component — `components/form/<Name>.tsx`

A **form component** is a single React TSX file that an agent presents to the human by passing it as a JSX descriptor to the `ask()` global `sdk/org/libs/core/src/globals/ask.ts#createAskGlobal`. Where a [view component](./view.md) only displays data via `display()`, a form component *collects input* — `ask()` pauses the turn, the render surface shows the form, and the collected value is returned to the calling turn `sdk/org/libs/core/src/globals/ask.ts#createAskGlobal`.

## A single TSX file (the `web.tsx`/`ink.tsx` split is gone)

A form component is one `<Name>.tsx` file, exactly like a view component — the former `<Name>/{web,ink}.tsx` two-file split has been removed. `loadComponents` reads each `.tsx`/`.ts` entry directly under `components/form/` into `space.components.form`, keyed by the file's basename `sdk/org/libs/core/src/spaces/load.ts:234-241`. A directory entry still holding the legacy `web.tsx`/`ink.tsx` layout is read defensively (preferring `web.tsx`, else `ink.tsx`) so not-yet-migrated on-disk spaces keep loading, but the canonical shape is a single file `sdk/org/libs/core/src/spaces/load.ts:242-248`.

## Availability to an agent

A form component is offered to an agent only if its name appears in that agent's `components:` frontmatter `sdk/org/libs/core/src/spaces/components.ts#getAgentComponents`. `getAgentComponents` filters the space's registered components to the names in `agent.config.components`; a name found in `space.components.form` is returned in the `form` map `sdk/org/libs/core/src/spaces/components.ts#getAgentComponents`. The typecheck overlay declares every referenced component (view and form are treated identically now — both single-file sources) as `declare function <Name>(props: <Name>Props): JSXDescriptor`, extracting the `Props` interface from the source (falling back to `Record<string, unknown>`) so `ask(<ArticleForm .../>)` typechecks `sdk/org/libs/core/src/typecheck/overlay.ts:80-92`.

**The component's TSX body never runs inside the sandbox.** In the VM every catalog name and every one of the agent's component names is bound to a stub object `{ displayName: name }`, and the injected `React.createElement` shim turns a stub into a plain descriptor — so `ask(<ArticleForm title="x" />)` yields `{ type: 'ArticleForm', props: { title: 'x' }, children: [] }` and nothing more `sdk/org/libs/core/src/exec/bootstrap.ts:241-264`. The source file matters only (a) to the DTS overlay above and (b) to the render surface, which imports it as a real React component (see below).

## Presented via `ask()`

`ask(descriptor)` validates the descriptor, pushes a single `{kind:'ask'}` yield, and returns a `Promise` that resolves when the render surface submits a value `sdk/org/libs/core/src/globals/ask.ts#createAskGlobal`. Validation is security-oriented: it rejects a non-descriptor argument, blocks dangerous element types (`script`/`iframe`/`object`/`embed`/`frame`/`frameset`), forbids `dangerouslySetInnerHTML`, and rejects `javascript:` URLs in any prop — recursively over children `sdk/org/libs/core/src/globals/ask.ts:8-58`. The yield carries `[id, descriptor]`; the session handles `kind:'ask'` by calling `renderHost.ask(id, descriptor)` and awaiting the user's input `sdk/org/libs/core/src/session/session.ts#Session.handleYield`. The `RenderHost.ask(id, descriptor)` interface returns `Promise<unknown>` — the collected value `sdk/org/libs/core/src/session/types.ts#RenderHost.ask`.

`ask` is **top-level-session-only**. One `CapabilityProfile` drives both injection and the DTS: the session profile sets `ask: true`, the fork and delegate profiles set `ask: false` `sdk/org/libs/core/src/exec/capability.ts#sessionCapabilities,104,115`; the bootstrap injects the global only when `caps.ask` `sdk/org/libs/core/src/exec/bootstrap.ts:179` and emits `ASK_DTS` only when `caps.ask` `sdk/org/libs/core/src/exec/bootstrap.ts#buildAmbientDts`. The pre-built bundle for headless VMs, `LIBRARY_DTS_NO_ASK`, likewise omits it `sdk/org/libs/core/src/typecheck/library-dts.ts#LIBRARY_DTS_NO_ASK`, so a stray `ask()` in a fork or delegate is a *typecheck* error ("Cannot find name 'ask'") rather than a hang `sdk/org/libs/core/src/typecheck/library-dts.test.ts:44-48`. The `ask` DTS signature accepts a JSX descriptor or a bare string `sdk/org/libs/core/src/typecheck/library-dts.ts#ASK_DTS`.

## How the descriptor is rendered — three branches

The chat surface's `AskForm` dispatches on the descriptor in this order `sdk/org/libs/ui/src/chat/app/Message.tsx:60-80`:

1. **A consent descriptor** → the `ConsentCard` `sdk/org/libs/ui/src/chat/app/Message.tsx:60-66`.
2. **A registered space component** — `descriptor.type` looked up in the `window.__SPACE_COMPONENTS__` registry; the real React component is rendered and handed `{...props, onSubmit}` `sdk/org/libs/ui/src/chat/app/Message.tsx:38-40,67-68`. It resolves the pending `ask()` by calling `onSubmit(value)`, which is posted back as `{type:'submitForm', id, value}` `sdk/org/libs/ui/src/chat/app/Message.tsx:42`. **This is the branch a `components/form/<Name>.tsx` file exists for** — hence the mandatory `onSubmit` prop.
3. **A catalog form descriptor** → `CatalogForm` `sdk/org/libs/ui/src/chat/app/Message.tsx:69-70`. `isFormDescriptor` recognises only *catalog* types (`Form`/`Fieldset`/`Field` plus the known field kinds) `sdk/org/libs/core/src/ui/form.ts#isFormDescriptor`.

Anything else falls through to a plain text input `sdk/org/libs/ui/src/chat/app/Message.tsx:71-80`. The terminal renderer has only the catalog branch: a catalog descriptor gets the interactive `InkForm`, everything else gets a text prompt `sdk/org/libs/cli/src/render/ink-renderer.tsx:294-306` — a *space* form component has no terminal renderer at all.

> **Gotcha — the registry is populated only by the CLI `--web` DevTools UI.** Its esbuild virtual entry imports each of the agent's form components (single-file `<Name>.tsx`, with the legacy `<Name>/web.tsx` as fallback) and assigns `window.__SPACE_COMPONENTS__` before mounting `sdk/org/libs/cli/src/web/serve.ts#buildBundle`. Nothing else in the repo writes that global, so in the shipped chat SPA `spaceComponents()` returns `{}` `sdk/org/libs/ui/src/chat/app/Message.tsx:18-22`, and an `ask(<ArticleForm/>)` — whose descriptor type is not a catalog name — degrades to the plain text input. **For a form that works on every surface, build it from the catalog inline (below) rather than as a `components/form/` file.**

## The portable path: catalog JSX passed straight to `ask()`

The shared **form catalog** — `TextField`, `TextArea`, `Select`, `MultiSelect`, `Checkbox`, `Slider`, `ConfirmButtons`, and the `Form`/`Fieldset`/`Field` wrappers, among others `sdk/org/libs/core/src/ui/catalog.ts#FORM_CATALOG` — is bound as stubs in every VM, so an agent can write the form inline. `flattenForm` turns the descriptor into a `FormSpec`: a bare single control (`single: true`) resolves `ask()` with a bare value, while a `Form`/`Fieldset` wrapper resolves with an object keyed by each field's `name` `sdk/org/libs/core/src/ui/form.ts#flattenForm`. `Field` wrapper `label`/`help` flow onto the inner control `sdk/org/libs/core/src/ui/form.test.ts:44-59`, and unnamed fields are auto-named `sdk/org/libs/core/src/ui/form.test.ts:61-64`. Raw control values are coerced per field kind (numbers parsed, checkboxes to boolean, tag/multi inputs to arrays) `sdk/org/libs/core/src/ui/form.ts#coerceValue`. Web (`CatalogForm`) and terminal (`InkForm`) share this flatten/coerce path, so `ask(<Form>…</Form>)` behaves identically on both surfaces `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx:1-10`.

```tsx
// Written inline by the agent — no components/form/ file needed.
const article = await ask(
  <Form submitLabel="Save">
    <TextField name="title" label="Title" />
    <Field label="Summary" help="one or two sentences">
      <TextArea name="summary" rows={3} />
    </Field>
    <Checkbox name="urgent" label="Publish immediately" />
  </Form>,
); // → { title, summary, urgent }
```

## Worked example — a `components/form/` file

No `components/form/<Name>.tsx` exists anywhere in the working tree today (a `find` for `components/form/**/*.tsx` matches only detached git worktrees; every shipped system space and every `store/projects/*/spaces/*` ships `components/view/` only). The example below therefore follows the contract the renderer actually imposes: a **real React component**, default-exported, that receives `onSubmit` and calls it with the value it collected. It is bundled and executed in the browser, not in the sandbox, so it must not reference the catalog stub names — those exist only inside the VM `sdk/org/libs/core/src/exec/bootstrap.ts:260-264`.

```tsx
import React from 'react';

interface Props {
  placeholder?: string;
  /** Supplied by the renderer; calling it resolves the pending ask(). */
  onSubmit: (value: { title: string; urgent: boolean }) => void;
}

/** Collects an article title + urgency. ask() resolves with { title, urgent }. */
export default function ArticleForm({ placeholder = 'Title…', onSubmit }: Props) {
  const [title, setTitle] = React.useState('');
  const [urgent, setUrgent] = React.useState(false);
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <input
        className="w-full rounded border border-border bg-background px-2 py-1 text-foreground"
        placeholder={placeholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="text-sm text-muted-foreground">
        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
        Publish immediately
      </label>
      <button
        className="rounded bg-primary px-3 py-1 text-primary-foreground"
        onClick={() => onSubmit({ title, urgent })}
      >
        Save
      </button>
    </div>
  );
}
```

The agent lists `ArticleForm` in its `components:` frontmatter, then `const article = await ask(<ArticleForm />)`. The descriptor `{type:'ArticleForm', props:{}, children:[]}` is looked up in the registry, and the payload the component passes to `onSubmit` becomes the resolved value `sdk/org/libs/ui/src/chat/app/Message.tsx:38-42,67-68`.

## Design tokens only

Like view components, form components are styled with `@lmthing/css` design tokens; **no raw colors** — use token utilities (`bg-card`, `text-foreground`, `border-border`, …). Note the automated gate does not reach here: `pnpm lint:tokens` runs the linter over the lib/SPA `src` trees only (`sdk/org/libs/{css,ui}/src`, `sdk/org/apps/web/src`, and `com|social|team|store|space|blog|casa|org/src`) `package.json:14`, and CI runs that same command `.github/workflows/design-tokens.yml`. On-disk space components (`store/projects/*/spaces/*/components/**`, `.lmthing/spaces/**`) sit outside those paths, so for them the no-raw-color rule is a review-enforced convention `CLAUDE.md`.

## See also

- [`components/view/<Name>.tsx`](./view.md) — the display-only sibling, rendered via `display()`.
- [`components/{view,form}/` overview](./README.md) — where both kinds live and how they are referenced.
- [`runtime-globals/conversation`](../../../runtime-globals/conversation.md) — `ask()`/`display()` from the globals' side, including the same registry gotcha.
