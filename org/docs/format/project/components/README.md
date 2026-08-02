# `components/<Name>.view.json` — reusable view fragments

A project-app's shared "component library" is a set of **view components** — named, parameterised compositions of view elements, not React. `components/` is a top-level project directory (a sibling of `views/ pages/ api/ hooks/ database/`), distinct from a **space's** agent-rendered `components/{view,form}` (see [../../space/components/README.md](../../space/components/README.md)) and from the legacy `pages/components/<Name>.tsx` React library a hand-written TSX app could once hold.

## The writer — `writeProjectViewComponent`, under `views:write`

`views:write` is the ONLY UI-authoring capability. It earns `writeProjectViewComponent(name, def)`, which validates `def` against the project's real endpoint contracts (props declared, references acyclic, bindings well-formed) exactly like a page spec, then writes `components/<Name>.view.json` (`sdk/org/libs/cli/src/app/authoring/globals.ts#writeProjectViewComponent`, `sdk/org/libs/cli/src/app/view-spec/validate.ts#validateViewComponent`). `<Name>` must be **PascalCase** (`COMPONENT_NAME_RE` — `sdk/org/libs/cli/src/app/authoring/globals.ts#COMPONENT_NAME_RE`). Its DTS lives in `PROJECT_VIEW_DTS`, gated on the same `views:write` grant as the page/layout/shell writers (`sdk/org/libs/core/src/typecheck/library-dts.ts#PROJECT_VIEW_DTS`).

There is no writer, and no capability, for a hand-written `.tsx` component — that surface (`writeProjectComponent`, gated on a `pages:write` capability id) was removed from the codebase entirely, along with the id itself. A component is data or it does not exist.

A `ViewComponentSpec` is `{ name, props?, node, description? }`: `props` declares typed parameters referenced inside the composition as `$props.<key>`, and `node` is the element tree (or another component reference) the definition renders (`sdk/org/libs/cli/src/app/view-spec/schema.ts#ViewComponentSpec`). Writing one **re-emits every page wrapper in the app**, because a wrapper inlines every component it renders with — there is no separate component bundle to invalidate (`sdk/org/libs/cli/src/app/authoring/globals.ts:574-613`).

## Referenced from a page as `{ use: '<Name>' }`

Any section slot — a list item, a detail field, a toolbar action — can be an element tree, a flat convenience object, or a **component reference**: `{ use: 'RecipeCard', props: { title: '$.name' } }` (`sdk/org/libs/cli/src/app/view-spec/schema.ts#ComponentRef`, `sdk/org/libs/cli/src/app/view-spec/schema.ts#Slot`). The referenced name is checked against the project's declared components at save time, the same way an endpoint name is checked — an unknown reference is a menu-shaped, retryable rejection, not a silent miss.

## Design tokens — structurally, not by convention

A view component's only styling dial is a semantic **`tone`** drawn from a closed set (`neutral accent success warning danger info auto`), mapped to a design token by the renderer (`sdk/org/libs/cli/src/app/view-spec/schema.ts#TONES`). There is no class name and no color literal anywhere in the spec vocabulary, so the token-only rule every other lmthing surface enforces by lint holds here by construction — a spec has nowhere to put a raw hex even if a model tried. Full ruleset (for the surfaces that DO carry raw markup) → [../../../design-system/README.md](../../../design-system/README.md).

## A legacy React component library can still exist and still serve

A project built before the builder went spec-only (or a store-catalog app) may still carry a `pages/components/<Name>.tsx` library — plain React components imported by its hand-written pages via a relative path, e.g. `import { InsightsPanel } from '../components/InsightsPanel'` (`store/projects/blog/pages/insights.tsx:3`). The page-build route walker still skips any `components/`/`lib/` directory under `pages/` and any `_`-prefixed file when discovering routes (`sdk/org/libs/cli/src/app/build/pages.ts#walkPages`), so such a library never becomes routes. Components there may import each other, import DB-derived row types from the generated `@app/types` module, and use `@app/runtime` client helpers such as `Link` — see the worked example in [../pages/README.md](../pages/README.md#worked-example--a-hand-written-legacy-page). Nothing writes a NEW file into a `.tsx` component library today: the writer that once did (`writeProjectComponent`) and its lint (a required default export) were removed along with `pages:write`. A hand-written component that already exists on disk is discipline-only for the token rule and for CI coverage — neither the `lint-design-tokens` gate (which never walks `store/projects/`) nor anything in the page build checks its colors.

## See also

- [../pages/README.md](../pages/README.md) — the view-spec pages that reference these components, and the legacy hand-written pages that may still import a `.tsx` component library.
- [../pages/view-spec.md](../pages/view-spec.md) — the full spec format, section kinds and element catalogue.
- [../../../runtime-globals/app-authoring.md](../../../runtime-globals/app-authoring.md) — the writer contract in the context of every other project-authoring global.
- [../../space/components/README.md](../../space/components/README.md) — the different, agent-rendered space `components/{view,form}`.
