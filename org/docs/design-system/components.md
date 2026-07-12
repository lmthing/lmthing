# UI Component Catalog

The **built-in component catalog** is the cross-platform UI vocabulary an agent can render into a conversation with `display()` (output) and `ask()` (interactive input). It is a single, hand-maintained data table in `sdk/org/libs/core/src/ui/catalog.ts` that drives three things at once: the JSX globals the model can type-check against, the summary the model sees in its system prompt, and the two host renderers (terminal Ink + web React) that turn a descriptor into pixels. All entries are **always in scope, no import needed** `sdk/org/libs/core/src/ui/catalog.ts:159-160`.

This is **distinct from a space's own `components/`** directory — those are per-agent, opt-in React modules an agent references in `components:` frontmatter (see [`../format/space/components/README.md`](../format/space/components/README.md)). The catalog components are universal primitives; a space component is a bespoke widget that itself renders down to catalog primitives.

## The catalog data structure

Each entry is a `CatalogEntry`: a descriptor `type`/JSX tag `name`, a `kind` (`'display'` | `'form'`), a one-line `doc`, a typed `props` list, and a `children` flag for components that accept nested JSX/text `sdk/org/libs/core/src/ui/catalog.ts:24-32`. A `CatalogProp` carries a `name`, a verbatim TypeScript `type` literal, an `optional` flag, and optional `doc` `sdk/org/libs/core/src/ui/catalog.ts:16-22`.

Three helper factories build the props shared across form controls: `name` (field key in the submitted object), `label` (visible label), and `help` (description text). A shared `onSubmit` prop `(value: any) => void` is marked `optional` and documented as "Supplied by the host; do not pass when authoring JSX for ask()" `sdk/org/libs/core/src/ui/catalog.ts:34-42`.

The exported tables are `DISPLAY_CATALOG` `sdk/org/libs/core/src/ui/catalog.ts:46-82`, `FORM_CATALOG` `sdk/org/libs/core/src/ui/catalog.ts:86-120`, and their concatenation `CATALOG` `sdk/org/libs/core/src/ui/catalog.ts:122`. Type names are matched **case-insensitively** by the renderers, so the model may write `<Stack>` or `<stack>` `sdk/org/libs/core/src/ui/catalog.ts:12-13`; `CATALOG_BY_NAME` is the lower-cased lookup that enforces this `sdk/org/libs/core/src/ui/catalog.ts:125-127`.

`@lmthing/core` re-exports the whole catalog API from its barrel `sdk/org/libs/core/src/index.ts:24-27` and from the browser-safe `@lmthing/core/ui` entry (no Node deps, so the web bundle can import it) `sdk/org/libs/core/src/ui/index.ts:1-15`.

## Display components (use with `display()`)

Fire-and-forget output primitives `sdk/org/libs/core/src/ui/catalog.ts:46-82`. `+children` means the tag takes nested JSX/text.

| Component | Props | Children |
|---|---|---|
| `Heading` | `level?: 1 \| 2 \| 3 \| 4` | yes |
| `Paragraph` | — | yes |
| `Text` | `color?: string`, `bold?: boolean`, `dim?: boolean`, `italic?: boolean` | yes |
| `Strong` | — | yes |
| `Em` | — | yes |
| `Muted` | — | yes |
| `Code` | — | yes |
| `Kbd` | — | yes |
| `CodeBlock` | `lang?: string` | yes |
| `Markdown` | `text?: string` | yes |
| `Stack` | `gap?: number` (vertical layout) | yes |
| `Row` | `gap?: number`, `justify?: 'start'\|'center'\|'end'\|'between'`, `align?: 'start'\|'center'\|'end'` | yes |
| `Columns` | `gap?: number` (equal-width columns) | yes |
| `Spacer` | — (flexible gap) | no |
| `Divider` | `label?: string` | no |
| `Card` | `title?: string` | yes |
| `Panel` | `title?: string` | yes |
| `Callout` | `variant?: 'info'\|'success'\|'warning'\|'error'`, `title?: string` | yes |
| `Alert` | `variant?: …` (alias of Callout) | yes |
| `Banner` | `variant?: …` (full-width) | yes |
| `Badge` | `color?: string` | yes |
| `Tag` | `color?: string` | yes |
| `Pill` | `color?: string` | yes |
| `List` | `items?: string[]` (or ListItem children) | yes |
| `OrderedList` | `items?: string[]` | yes |
| `ListItem` | — | yes |
| `Table` | `columns: string[]`, `rows: (string \| number)[][]` | no |
| `KeyValue` | `pairs: Record<string, string \| number>` | no |
| `ProgressBar` | `value: number`, `max?: number`, `label?: string` | no |
| `Spinner` | `label?: string` | no |
| `StatCard` | `label: string`, `value: string \| number`, `delta?: string` | no |
| `Timeline` | `items: { title: string; time?: string; detail?: string }[]` | no |
| `Link` | `href: string` | yes |
| `Quote` | — | yes |
| `Details` | `summary: string` (collapsible) | yes |

## Form components (use with `ask()`)

Interactive controls that resolve the `ask()` promise `sdk/org/libs/core/src/ui/catalog.ts:86-120`. Every control carries the shared `onSubmit` prop the host supplies (never authored). A bare control resolves to its single value; a `<Form>` resolves to an object keyed by each field's `name` `sdk/org/libs/core/src/ui/catalog.ts:171`.

| Component | Notable props |
|---|---|
| `Form` | `submitLabel?: string` — wraps fields, submits one object; `+children` |
| `Fieldset` | `label?` — grouped fields with a legend; `+children` |
| `Field` | `label?`, `help?`, `error?: string` — label+control+help wrapper; `+children` |
| `TextField` | `name?`, `label?`, `help?`, `placeholder?`, `defaultValue?: string` |
| `TextArea` | `rows?: number`, `defaultValue?: string` |
| `NumberField` | `min?`, `max?`, `step?`, `defaultValue?: number` |
| `PasswordField` | `name?`, `label?`, `help?` |
| `EmailField` | `placeholder?: string` |
| `UrlField` | `name?`, `label?`, `help?` |
| `SearchField` | `placeholder?: string` |
| `Select` | `options: (string \| { label; value })[]`, `defaultValue?: any` |
| `MultiSelect` | `options`, `defaultValue?: any[]` |
| `Combobox` | `options` (autocomplete single-choice) |
| `RadioGroup` | `options`, `defaultValue?: any` |
| `CheckboxGroup` | `options` |
| `Checkbox` | `defaultValue?: boolean` (single boolean) |
| `Switch` | `defaultValue?: boolean` (toggle) |
| `Slider` | `min?`, `max?`, `step?`, `defaultValue?: number` |
| `Stepper` | `min?`, `max?`, `defaultValue?: number` |
| `DatePicker` | `defaultValue?: string` |
| `TimePicker` | `name?`, `label?` |
| `DateTimePicker` | `name?`, `label?` |
| `ColorPicker` | `defaultValue?: string` (hex on terminal) |
| `FileField` | `name?`, `label?`, `help?` |
| `TagInput` | free-form tag/chips input |
| `Rating` | `max?`, `defaultValue?: number` (stars) |
| `OtpInput` | `length?: number` (PIN) |
| `PhoneField` | `name?`, `label?` |
| `CurrencyField` | `currency?: string` |
| `Button` | `value?: any`, `variant?: 'primary'\|'secondary'\|'danger'`; resolves `ask()` with its `value`; `+children` |
| `SubmitButton` | submits the enclosing `Form`; `+children` |
| `ButtonGroup` | `options`; resolves with the chosen value |
| `ConfirmButtons` | `confirmLabel?`, `cancelLabel?`; resolves boolean |

## How the catalog reaches the model

The catalog is the single source of truth for three derived outputs, so they never drift:

1. **System-prompt summary.** `catalogSummary()` renders each entry as a compact one-line signature (`Callout {variant?: 'info'|'success'|'warning'|'error', title?: string} +children`) grouped under **Layout / display** and **Forms** headings, with worked `display(...)` / `ask(...)` examples `sdk/org/libs/core/src/ui/catalog.ts:154-178`. Showing exact prop names + types (not just the tag name) exists specifically to stop the model guessing wrong props from training priors — the recurring `Callout type=` (should be `variant`), `KeyValue data=` (should be `pairs`), `Table title=` (no such prop) churn that otherwise burns typecheck-retry turns `sdk/org/libs/core/src/ui/catalog.ts:140-152`. `componentSignature` drops the host-supplied `onSubmit` prop from the summary `sdk/org/libs/core/src/ui/catalog.ts:145-152`. The summary is section **1a** of the system block, right after the globals summary `sdk/org/libs/core/src/context/system-block.ts:214-215`.

2. **Type-checked JSX globals.** `catalogDts()` emits one ambient `declare function <Name>(props?: { … }): JSXDescriptor;` per entry, appending `children?: any` for `+children` components `sdk/org/libs/core/src/ui/catalog.ts:181-192`. This is concatenated onto the library DTS the typechecker uses `sdk/org/libs/core/src/typecheck/library-dts.ts:108`. Every catalog component returns a `JSXDescriptor` (`{ type, props, children? }`) `sdk/org/libs/core/src/typecheck/library-dts.ts:42-46` — so `display(<Stack>…</Stack>)` and `await ask(<Form>…</Form>)` type-check without an import.

3. **Runtime JSX stubs.** At VM bootstrap, every `CATALOG_NAMES` entry (plus any space `componentNames`) is injected as a global `{ displayName: name }` stub `sdk/org/libs/core/src/exec/bootstrap.ts:236-240`, alongside a `React.createElement` shim that builds descriptors `{ type, props, children }` `sdk/org/libs/core/src/exec/bootstrap.ts:216-234`. So when the model's transpiled JSX calls `React.createElement(Stack, …)`, `Stack` resolves to its stub and the call yields a plain descriptor object — no real React runs in the sandbox.

## How a descriptor is rendered (both surfaces)

A descriptor produced in the sandbox is rendered **host-side**, identically in intent on terminal and web. The web renderer is `renderDescriptor` in `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:10-143` — a case-insensitive `switch` on `d.type` mapping each catalog type to token-styled React (e.g. `stack` → a flex-column `div`, `table` → a real `<table>`, `callout`/`alert`/`banner` share one variant-colored branch) `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:22-142`. The terminal equivalent is `renderDescriptor` in `sdk/org/libs/cli/src/render/ink-renderer.tsx:59`. Parity between the two is pinned by shared-fixture tests (`render-catalog.web.test.tsx` and `ink-renderer.test.tsx` render the same `TABLE_FIXTURE`/`STACK_HEADING_FIXTURE`/`CALLOUT_FIXTURE`/… and assert equivalent output). An unknown `type` falls through to a diagnostic default branch rather than crashing `sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:141`.

### Form normalization

Form descriptors take an extra normalization pass so `ask(<Form>…)` behaves identically on both surfaces, in `sdk/org/libs/core/src/ui/form.ts`. `flattenForm` walks a `Form`/`Fieldset`/`Field` tree collecting leaf controls into a flat `FieldSpec[]`, merging a `<Field label=…>` wrapper's label/help/error into the inner control `sdk/org/libs/core/src/ui/form.ts:111-151`. `KIND_BY_TYPE` maps each catalog form tag to a normalized `FieldKind` — and adds two **renderer-only aliases** not in the catalog: `dropdown` → `select` `sdk/org/libs/core/src/ui/form.ts:58-69`. `single` is `true` when the descriptor is a bare control (resolve with the value) and `false` for a multi-field `<Form>` (resolve with an object) `sdk/org/libs/core/src/ui/form.ts:142-151`. `coerceValue` casts raw control output to the field's typed value (numbers, booleans, arrays for multi-select/tags) `sdk/org/libs/core/src/ui/form.ts:154-169`; `defaultFor` supplies a pre-interaction default `sdk/org/libs/core/src/ui/form.ts:172-182`. The web form UI is `CatalogForm.tsx`, which imports `flattenForm`/`coerceValue`/`defaultFor` from `@lmthing/core/ui` `sdk/org/libs/ui/src/chat/components/forms/CatalogForm.tsx:9-10`. `isFormComponent`/`isCatalogForm` report whether a tag name is a form control `sdk/org/libs/core/src/ui/catalog.ts:129-131` `sdk/org/libs/core/src/ui/form.ts:185-187`.

## How a space component uses the catalog

A space component (`components/view/<Name>.tsx` or `components/form/<Name>.tsx`, see [`../format/space/components/README.md`](../format/space/components/README.md)) is authored as normal single-file React and may **import catalog components for editor ergonomics** — `import { Stack } from '@lmthing/ui'`. Core never evaluates component source directly (component files are read only for AST extraction — Props/JSDoc); rendering happens host-side from `JSXDescriptor` data `sdk/org/libs/core/src/typecheck/overlay.ts:160-172`. For callers that DO eval component source, `stripCatalogImports` removes any `import { … } from '@lmthing/…'` line whose named imports are catalog components, since at runtime those names are plain VM globals, not resolvable modules `sdk/org/libs/core/src/typecheck/overlay.ts:174-182`.

A space component's own props become typed JSX globals via `buildOverlay`: it extracts the component's `interface Props { … }` (renamed `<Name>Props`, function-typed members forced optional) and emits `declare function <Name>(props: <Name>Props): JSXDescriptor;`, falling back to `Record<string, unknown>` props when no interface is found `sdk/org/libs/core/src/typecheck/overlay.ts:63-95` `sdk/org/libs/core/src/typecheck/overlay.ts:23-56`. Its JSDoc description is extracted by `extractComponentDoc` and advertised in the system block's **Components** section `sdk/org/libs/core/src/typecheck/overlay.ts:141-158` `sdk/org/libs/core/src/context/system-block.ts:316-338`. Space components are only surfaced to an agent that lists them in `components:` frontmatter, and form components are omitted for autonomous (delegated/headless) agents that have no `ask()` `sdk/org/libs/core/src/context/system-block.ts:328-336`.

> Catalog components are also injected as VM stubs at bootstrap alongside space `componentNames` `sdk/org/libs/core/src/exec/bootstrap.ts:236` — so inside a space component a `<Stack>`/`<Card>` reference resolves to the same descriptor-building path as a first-class catalog tag.

## See also

- [`../format/space/components/README.md`](../format/space/components/README.md) — a space's own `view/`+`form/` components and the `components:` frontmatter allow-list.
- [`./tokens.md`](./tokens.md) — the design tokens catalog components style with (never raw colors).
- [`./README.md`](./README.md) — design-system overview.
- [`../runtime-globals/README.md`](../runtime-globals/README.md) — `display()` / `ask()`.
