# App views — the client layer of a project-app

> **There is one view layer: the view spec**, rendered by a shared `ViewRenderer` that runs on the
> web bundle *and* natively in the mobile app with no WebView (below). A hand-authored React/TSX
> page format existed earlier in the project's history and has been **fully removed** — the
> per-project esbuild page-build pipeline, the `@app/runtime` client library
> (`useApi`/`useApiMutation`/`Link`/`navigate`/`<Chat>`), and their serving code are gone along
> with it, not merely deprecated. `views:write` is the ONE UI-authoring capability, earning
> `system-appbuilder` (the sole app builder) the view-spec writers
> `sdk/org/libs/core/src/typecheck/library-dts.ts#PROJECT_VIEW_DTS`. A project's pages are served
> by a separate prebuilt SPA, **AppHost** (`sdk/org/apps/app-shell/src/app-host.tsx#AppHost`), which
> FETCHES the specs over `GET /api/apps/:id/views` and mounts them with the `ViewRenderer` below —
> the mobile app fetches the identical payload, through the same `createViewClient`
> (`sdk/org/libs/ui/src/view/client.ts#createViewClient`). The spec FORMAT the model authors is
> [../format/project/pages/view-spec.md](../format/project/pages/view-spec.md).

- The endpoints these views call → [../format/project/api/README.md](../format/project/api/README.md)
- URL mounts, serving → [./routes.md](./routes.md) · build/db/hooks behavior → [./features.md](./features.md)

---

# The ViewRenderer — spec pages, rendered natively

Everything above describes a page that is **React**. The page `system-appbuilder` authors is not
code at all: it is a **spec**, a plain object validated at save time against the project's endpoint
contracts and drawn by one shared renderer. Because a spec is DATA, the mobile app can fetch it and
render it with the same component the web bundles — which is the one thing no amount of improvement
to a TSX-authoring builder could produce, since its output is an esbuild browser bundle.

The renderer lives in `@lmthing/ui`, not in the CLI, precisely so both consumers can import it
`sdk/org/libs/ui/package.json:12`.

## The contract

```tsx
import { ViewRenderer, ViewThemeProvider, createViewClient } from '@lmthing/ui/view'

const client = createViewClient({ baseUrl, getToken, endpoints })
<ViewRenderer spec={spec} components={components} shell={shell} client={client} route={route} />
```

`ViewThemeProvider` is the theme context the renderer's `Prim.*` primitives require — every one of
them calls Tamagui's `useTheme()`, which throws `Missing theme.` outside a provider. It is
**AppHost's** alias for `UiThemeProvider`, which every `@lmthing/ui` host needs and which
therefore lives with the config it mounts `sdk/org/libs/ui/src/theme/provider.tsx#UiThemeProvider`;
the alias stays because the name is baked into the codegen, the DTS shim and the validator
`sdk/org/libs/ui/src/view/provider.tsx:15`. A host that already has one does **not**
wrap it (the unified web SPA at `sdk/org/apps/web/src/routes/__root.tsx:22-29`, the mobile app at
its own root); **AppHost** does, because it is the one delivery path that owns no root of its own
`sdk/org/apps/app-shell/src/app-host.tsx#AppHost`.

`ViewRenderer` takes the page spec, the component definitions a `{ use: … }` reference resolves
against, the app shell, the data client, optionally every route in the app (for shell derivation)
and optionally the current route `sdk/org/libs/ui/src/view/renderer.tsx#ViewRendererProps`.
`components` accepts an array or a name-keyed map `sdk/org/libs/ui/src/view/renderer.tsx#toComponentMap`.
The spec types are a **structural mirror** of the pinned contract in
`sdk/org/libs/cli/src/app/view-spec/schema.ts` rather than an import of it, because `@lmthing/cli`
depends on `@lmthing/ui` and importing back would be a package cycle — and because that module is
node code (ajv, `fs`) that must never reach the Metro graph
`sdk/org/libs/ui/src/view/types.ts:1-30`.

## The client — one code path, two configurations

A spec names endpoints, never URLs and never fetch code. `createViewClient` turns a name into a
request with exactly `@app/runtime`'s `buildRequest` semantics — `:param` segments filled from
`input` and consumed, `GET`/`DELETE` remainders to the query string, `POST`/`PATCH`/`PUT`
remainders to a JSON body `sdk/org/libs/ui/src/view/client.ts#buildViewRequest`. Those semantics
are re-implemented rather than imported for the cycle reason above, and pinned against the same
cases as the CLI copy `sdk/org/libs/ui/src/view/client.test.ts:31-64`.

| | web (a generated wrapper page) | native (`apps/mobile`) |
|---|---|---|
| `baseUrl` | the app base (`…/app/<project>`), relative | the **absolute** pod URL |
| `getToken` | omitted — the pod is same-origin and cookie-authed | the pod token, sent as `Authorization: Bearer` |
| `endpoints` | injected as `window.__APP_ENDPOINTS__` | from `GET /api/apps/:id/views` |

Nothing in the client assumes an origin — the `createTeamClient` pattern
(`sdk/org/libs/ui/src/team/client.ts#createTeamClient`) applied to app data
`sdk/org/libs/ui/src/view/client.ts#createViewClient`.

**Host capabilities are symmetric.** `navigate`, `openExternal`, `copyToClipboard`, `print`,
`saveFile` and `confirm` are things only the host can do, so they are configuration; the native
host supplies them (`Linking`, `expo-clipboard`, `Alert`) and the web side falls back to the
browser's own implementation when a DOM is present, so a `{ copy }` button cannot work on a phone
and silently do nothing in a browser `sdk/org/libs/ui/src/view/client.ts#webCopy`. `navigate` is
deliberately **not** defaulted: routing belongs to the host's router, and a guessed
`location.assign` would break a SPA's history rather than degrade
`sdk/org/libs/ui/src/view/client.ts:180-196`.

## The runtime the spec replaces

The renderer owns the whole `useApi` lifecycle, per `ViewRenderer` instance rather than in a
module-level registry — a mobile host renders a spec, navigates, and renders another
`sdk/org/libs/ui/src/view/runtime.tsx#ViewRuntimeProvider`:

- **fetch on mount and on input change**, keyed by the serialised input so a fresh object literal
  each render does not re-fire `sdk/org/libs/ui/src/view/runtime.tsx#useViewQuery`;
- **last-write-wins stale-drop** — every fetch takes a request id and a response that is not the
  latest is discarded, so rapid facet changes cannot flip `data` back
  `sdk/org/libs/ui/src/view/runtime.tsx#useViewQuery`;
- **an invalidation registry keyed by endpoint name** — the only identifier a spec has. A
  mutation always invalidates its own name as well, so a section reading an endpoint that is also
  written to (a toggle) sees its own write `sdk/org/libs/ui/src/view/runtime.tsx#useViewMutation`;
- **`poll {everyMs, while:{field, in:[…]}}`** — a named declarative policy, not a predicate:
  refetch while `while.field` holds one of `while.in`, evaluated **per row and true if any row
  matches** `sdk/org/libs/ui/src/view/bind.ts#pollWhileHolds`;
- **`async {note, refetchAfter}`** on a `create` — a background import shows the note and
  re-invalidates after N ms `sdk/org/libs/ui/src/view/sections/create.tsx#CreateSectionView`;
- **per-section `isLoading` / `isFetching` / `error`**, distinguishing a first load from a poll
  refresh `sdk/org/libs/ui/src/view/runtime.tsx#QueryState`;
- **`selectable` + `bulkActions`** — the selection is sent under the Input key named by the
  mutation's `arg`, because there is deliberately no `$selection` binding root
  `sdk/org/libs/ui/src/view/runtime.tsx#useSelection`, `sdk/org/libs/ui/src/view/actions.tsx#useDispatch`.

**A dependent query with an unresolved binding is DISABLED, not sent with holes in it.** Each
section publishes its Output under its `id`, a dependent section reads it as an ordinary
`$data.<id>.…` binding, and `resolveInputs` reports `ready: false` until every binding resolves —
which is what replaces the hand-coded `enabled:` flag on every dependent query in the corpus
`sdk/org/libs/ui/src/view/bind.ts#resolveInputs`, `sdk/org/libs/ui/src/view/runtime.tsx#usePublish`.
There is no topological sort: React's render already is one, so the page scope is simply rebuilt
when the published data changes `sdk/org/libs/ui/src/view/renderer.tsx#ViewPage`.

## Bindings are paths, and a null one omits its element

The evaluator is a **walker, not an interpreter** — there is no `eval`, no expression parser and
no template interpolation anywhere in the renderer, which is what makes "no app-authored code ever
executes on the phone" true by construction `sdk/org/libs/ui/src/view/bind.ts#resolveBinding`. The
eight roots are `$`, `$.field`, `$props.x`, `$route.id`, `$data.<sectionId>.<path>`,
`$result.field`, `$form.field` and `$client.timezone`; anything else resolves to `undefined`
rather than throwing.

An **argument** (a section's `input`, `mutate.input`, `navigate.params`, …) is a binding *or* a
constant: a non-string `Arg` resolves to itself, so `{ withinDays: 7 }` reaches the endpoint as the
number 7 and never as `'7'` `sdk/org/libs/ui/src/view/bind.ts#resolveInputs`. Only a **binding** can
be pending — an unresolved one disables its query, which is the declarative replacement for every
hand-coded `enabled:` flag; a constant is always ready.

**S1 — a bound value that resolves to nothing renders NOTHING, its label and wrapper included.**
A literal is never omitted. That asymmetry is the whole rule
`sdk/org/libs/ui/src/view/bind.ts#resolveValue`: it replaces the ~15 hand-written
`{x ? … : null}` guards the desk check found across ten pages, and it is what keeps the
no-conditionals rule honest — without it every spec page fills with empty chrome. A falsy *number*
or *boolean* is present (`0` items is a fact worth showing); an empty string or empty array from a
binding is not. It applies per keyvalue pair (an unpopulated field takes its label with it
`sdk/org/libs/ui/src/view/elements.tsx#KeyValueRows`) and per stats card (a metric the endpoint did
not compute leaves no tile reading "—" `sdk/org/libs/ui/src/view/sections/misc.tsx#StatsSectionView`).

## Loading, empty and error are RENDERER DEFAULTS

The completeness audit found **26 of 153** hand-built components across five apps were skeletons,
spinners, empty states and error notes — ~1,050 LOC that vanish here, 31% of the components that
disappear before any mapping (`design/viewspec-element-audit.md:57-74`). They are supplied by the
renderer and **there is deliberately no way to author one**: no `skeleton`, no `spinner`, no
`loading`, no `error` in the element catalogue `sdk/org/libs/ui/src/view/states.tsx:1-24`.

- **Loading** is a shaped placeholder, not a spinner — the shape is derived by the section from
  what it is about to draw, never authored `sdk/org/libs/ui/src/view/states.tsx#LoadingState`.
- **Error** names the failure and offers a **retry**, so a transient 502 from a pod that just woke
  does not need a page reload `sdk/org/libs/ui/src/view/states.tsx#ErrorState`.
- **Empty** always exists; a section's `empty:` is an *override* of it, not the authoring of a
  state. The default title is derived from the endpoint name
  `sdk/org/libs/ui/src/view/sections/common.tsx#SectionFrame`.
- A section that **throws** is contained: the rest of the page still renders and the failing
  section names itself, because a whole-page white screen is indistinguishable from "the builder
  produced nothing" `sdk/org/libs/ui/src/view/renderer.tsx#SectionBoundary`.
- **A row shape is derived from the data** when `item` is absent, which is what keeps
  `{ kind: 'list', query: 'X' }` a legal page rather than a blank one
  `sdk/org/libs/ui/src/view/sections/common.tsx#deriveItem`.

## Layout prediction — archetypes

A page's `layout` is normally absent and the archetype is predicted from the section composition
`sdk/org/libs/ui/src/view/archetype.ts#predictArchetype`. How often the model must set it
explicitly is the plan's **layout-override rate** ratchet metric, which is why the decision records
whether it was `authored` `sdk/org/libs/ui/src/view/archetype.ts#ArchetypeDecision`.

| composition | archetype |
|---|---|
| `stats` + ≥2 collections | `dashboard` |
| `detail` (+ related collections) | `detail` |
| `create` + a collection **on the same entity** | `list`, create as a collapsible header form |
| a single collection | `list` |
| create only | `form` |
| anything else | **`stack`**, the explicit fallback |

Three rules are load-bearing:

1. **An archetype NEVER reorders sections.** Section order is the array order. A "dashboard ⇒
   stats strip on top" heuristic would bury `kitchen/index`'s hero card, the one thing that page
   exists to show. Archetypes govern container width, grid columns and responsive collapse only —
   the decision object carries no ordering at all
   `sdk/org/libs/ui/src/view/archetype.ts#ARCHETYPE_WIDTH`, `sdk/org/libs/ui/src/view/archetype.ts#isGridCell`.
2. **`create` + `list` on one entity** is the commonest real shape (5 of the 10 desk-checked
   pages). The pairing is recognised from the create's `invalidates` — the model stating the
   relationship outright — falling back to the entity noun with its verb stripped
   `sdk/org/libs/ui/src/view/archetype.ts#sameEntity`, `sdk/org/libs/ui/src/view/archetype.ts#entityOf`.
3. **`master-detail` was exercised by zero of the ten measured pages.** It stays in the union, but
   the shape that would be master-detail deliberately renders as a detail page rather than
   sinking v1 time into split-pane logic; promoting it is a bucket-1 decision with evidence
   attached `sdk/org/libs/ui/src/view/archetype.test.ts:113-119`.

**Responsive behaviour lives inside the archetype**, via the Tamagui media breakpoints already
aligned to Tailwind's (`sdk/org/libs/css/src/tamagui/tokens.generated.ts:724-742`). The model never
writes a breakpoint.

Sections named by any `reveals` anywhere on the page start **hidden**; a section nothing reveals is
always shown, which is why the target set is computed page-wide rather than per section
`sdk/org/libs/ui/src/view/archetype.ts#revealTargetsOf`. `reveals` is the declarative replacement
for `useState`, and a press shows or hides all of a group at once — per-id toggling left a
partially-open page in every measured layout `sdk/org/libs/ui/src/view/runtime.tsx#ViewRuntimeProvider`.

## Layout prediction — the shell

The shell replaces the `_app.tsx`/`_layout.tsx` every catalogue app hand-writes. Nav is derived
from the route list **only up to `SHELL_DERIVE_MAX_ROUTES` (5) top-level static routes**
`sdk/org/libs/ui/src/view/types.ts#SHELL_DERIVE_MAX_ROUTES`; above that the model must declare
`groups` and the renderer derives nothing, reporting why
`sdk/org/libs/ui/src/view/shell.tsx#deriveNav`.

That threshold is measured, not taste: the desk check found **0 of 5** catalogue apps reproducing
from a flat route list — four hand-group 13–21 routes into 4–6 destinations, and a flat mapping
produces an unusable 13–21-item bottom bar on a phone. Deriving anyway would put the shell's own
layout-override rate near 80%, which by the plan's own metric means the *prediction* is wrong.

- **A parameterised route is never a *destination*** — `/feed/[articleId]` is a drill-in, and a tab
  that opens it opens nothing. It reaches the user through a `rowAction`, a `navigate`, or a subnav
  `sdk/org/libs/ui/src/view/shell.tsx#isStaticRoute`. A group's **highlight family** is the other
  role and takes the other rule: a member MAY be parameterised, because a drill-in is exactly the
  page its tab should stay lit for (kitchen's real `_layout.tsx` keeps Shop highlighted on
  `trip/:planId`) `sdk/org/libs/cli/src/app/view-spec/schema.ts#NavGroup`. A family member is
  matched by segment SHAPE, so `trip/[planId]` highlights on the live `trip/p7`
  `sdk/org/libs/ui/src/view/shell.tsx#routeShapeMatches`. Conflating the two roles made every
  drill-in an orphan unless some page happened to navigate to it.
- **Placement is target-predicted**: bottom tabs on a phone, a top bar on a wide screen with few
  destinations, a sidebar above four. All three are one tree with media-driven visibility, so
  there is no platform branch anywhere in the file `sdk/org/libs/ui/src/view/shell.tsx#ViewShell`.
- **Subnav** is entity-scoped and declared **once** per route family: `match` is a parameterised
  prefix (`trips/[tripId]`), matched by segment shape, and the current route's parameter values
  carry into every item — so an item is written once as `trips/[tripId]/expenses`, not once per
  trip and not once per page `sdk/org/libs/ui/src/view/shell.tsx#subnavFor`,
  `sdk/org/libs/ui/src/view/shell.tsx#matchesPrefix`. Without it a spec app's per-entity pages
  cannot reach each other at all.
- **Nav badges** are declared as a data source (an endpoint name plus a path into its Output), so
  they resolve at save time like everything else; a zero draws nothing. These apps run on
  background agents and the badge *is* the "something needs you" signal they produce
  `sdk/org/libs/ui/src/view/shell.tsx#BadgeCount`.
- **`shell.assistant`** is the `chat` section hoisted into the frame — the concierge dock 4 of the
  5 catalogue apps hand-build `sdk/org/libs/ui/src/view/shell.tsx#ViewShell`.

## Forms come from the endpoint's Input schema

A `create` section **declares no fields**. They derive from the mutation endpoint's Input JSON
Schema, following the `SettingsSchemaForm` precedent
(`sdk/org/libs/ui/src/elements/forms/settings-schema-form/index.tsx#SettingsSchemaForm`) and
extending it with the three cases the desk check blocked on
`sdk/org/libs/ui/src/view/form.tsx#deriveFields`, `sdk/org/libs/ui/src/view/form.tsx#controlFor`:

- **enums ⇒ selects**;
- **array-of-object ⇒ repeating row groups** (`homes/new`'s commute targets)
  `sdk/org/libs/ui/src/view/form.tsx#ObjectListField`;
- **`x-options` ⇒ endpoint-sourced options** — without it a foreign key renders as a raw UUID text
  box `sdk/org/libs/ui/src/view/form.tsx#QuerySelectField`.

Keys supplied by the page through `create.input` are **hidden** from the form and merged into the
submit. `prefill` with no `from` seeds the form on mount from the endpoint's Output by matching
field names; a prefill whose `input` binds `$form.*` cannot run on mount (the form is still empty),
so the renderer offers it as an explicit action instead — **derived from the spec, not declared**
`sdk/org/libs/ui/src/view/sections/create.tsx#bindsForm`. `merge: 'fill-empty'` is the only policy
in v1 `sdk/org/libs/ui/src/view/form.tsx#mergeFillEmpty`. Validation is not duplicated:
required-ness gates the submit button and everything else is ajv's job on the pod, whose
`{ error }` body the section shows `sdk/org/libs/ui/src/view/form.tsx#isComplete`.

## The element catalogue, and the two modifiers

24 elements, drawn from `Prim.*` and the `elements/*` catalogue
`sdk/org/libs/ui/src/view/elements.tsx#renderElement`. Prop names follow the descriptor renderer
(`sdk/org/libs/ui/src/chat/components/render-descriptor.tsx#renderDescriptor`) wherever it already
has the element; the deliberate divergences are that a spec has one finite **`tone`** where that
renderer takes a free-string `color`, and that list-shaped props carry **bindings** rather than
pre-materialised data, because a spec is authored before the data exists.

- **`format`** is a modifier on any bound value, absorbing the `format.ts` all five catalogue apps
  hand-write. `Intl` is used where it exists and every helper degrades to the plain value, because
  a throw inside a formatter would take down a page for a currency symbol
  `sdk/org/libs/ui/src/view/format.ts#applyFormat`. `currencyField` names the row field holding
  the ISO code, which the two multi-currency apps need `sdk/org/libs/ui/src/view/format.ts#formatBound`.
- **A MISSING `format` is inferred, because a spec that declares nothing must still read correctly.**
  The model binds a column to a slot and often says nothing else, and the renderer used to print the
  raw JS value: a generated job list shipped badges reading literally `false`, money as a bare `78`
  beside a sibling `70.49`, and a raw ISO date. So `formatBound` takes the binding EXPRESSION
  alongside the value and `inferFormat` fills the gap — a boolean reads `Yes`/`No` in any slot and
  tones a badge apart, and a number in a money-NAMED field renders with a symbol and consistent minor
  units `sdk/org/libs/ui/src/view/format.ts#inferFormat`. A declared `format` always wins.
  Money-ness cannot come from the type — `parts_total` and `in_shop_count` are both `number` — so the
  field name is the evidence, and a veto list keeps the rule off counts, durations, rates and
  coordinates, where a currency symbol would change what the number MEANS. The currency code has
  three sources in order: the row's own field, then the field name (`total_parts_gbp` ⇒ GBP), then the
  default `sdk/org/libs/ui/src/view/format.ts#DEFAULT_CURRENCY`.
- **A date-only value is formatted in UTC**, and this is a correctness fix rather than a preference:
  `new Date('2026-07-08')` is UTC midnight, so every `format: 'date'` — declared ones included —
  rendered **the previous day** anywhere west of Greenwich `sdk/org/libs/ui/src/view/format.ts#DateValue`.
- **`tone` is never a colour** — it maps to a design token, which is why a spec structurally cannot
  violate the design system `sdk/org/libs/ui/src/view/format.ts#TONE_TOKENS`. **`toneMap` is the
  load-bearing half**: `tone: 'auto'` cannot know that `self_care` is good news and `emergency` is
  not, so the model declares a lookup table — a third of the corpus gets conditional colour without
  the language gaining conditionals `sdk/org/libs/ui/src/view/format.ts#resolveTone`. A declared
  map wins over a literal tone; `auto`'s own vocabulary is kept deliberately small
  `sdk/org/libs/ui/src/view/format.ts#autoTone`.
- **`maxLines`** clamps with an ellipsis on both targets (RN's `numberOfLines` and the web
  line-clamp trio) `sdk/org/libs/ui/src/view/clamp.ts#clampProps`; **`strike`** and the other
  leaf props ride on `text` `sdk/org/libs/ui/src/view/types.ts#TextEl`.
- **`suffix`** puts a unit on a flat value — `meta: { value: '$.prepMinutes', suffix: 'min' }`
  renders "20 min" where a bare binding rendered "20" `sdk/org/libs/ui/src/view/types.ts#FlatValue`.
  It is appended **after** formatting (the unit belongs to the rendered figure, and `currency`
  already owns the symbol side) and is itself a value, so `suffix: '$.unit'` works and an
  unresolved one appends nothing rather than printing "20 undefined"
  `sdk/org/libs/ui/src/view/elements.tsx#FlatItemView`.
- **`field`** is the one element the audit added, and the one finding that was outright
  inexpressible: `button { mutate }` carries no argument, so without it a spec app renders every
  page and lets a user change nothing about a row. The new control value is sent under the Input
  key named by `arg`, defaulting to the last segment of `value`'s path
  `sdk/org/libs/ui/src/view/elements.tsx#FieldElement`, `sdk/org/libs/ui/src/view/bind.ts#lastSegment`.

## Native-first — what that costs and what it buys

The renderer is built on `Prim.*` so one definition draws on both targets. Three native traps are
designed around rather than discovered later:

- **Icons are SVG primitives, never lucide** (which renders a DOM `<svg>` and mounts nothing on a
  device). The set is finite by design — 32 names — and an unknown name draws a visible fallback
  glyph rather than a silent blank `sdk/org/libs/ui/src/view/icons.tsx#ViewIcon`,
  `sdk/org/libs/ui/src/view/types.ts#ICON_NAMES`.
- **Every string sits inside a `Prim.Text`.** React Native refuses a bare string in a View and then
  *drops* it, so a label vanishes rather than erroring — and neither jsdom nor
  `react-test-renderer` enforces the rule, which is why the native suite sweeps the whole mounted
  tree for loose strings `sdk/org/libs/ui/metro/suites/view.tsx:36-45`.
- **Yoga has no overflow scrolling**, so `scroll: 'x'` on `row`/`grid`/`table` is native
  *correctness*, not cosmetics: without a real scrolling host a wide table or a week grid is
  clipped with no gesture to reach the rest. `primitives/scroll` is vertical and forwards nothing
  that would make it horizontal, so the renderer carries its own one-file-per-host translation
  `sdk/org/libs/ui/src/view/hscroll.tsx#HScroll`,
  `sdk/org/libs/ui/src/view/hscroll.native.tsx#HScroll`. It is the renderer's **only** fork.
- The selects and toggles are drawn rather than delegated, because `Prim.Select`'s native fork is
  an inert placeholder (`sdk/org/libs/ui/src/elements/primitives/controls.native.tsx:88-95`) — a
  real `<select>` would leave every derived form unusable on a phone
  `sdk/org/libs/ui/src/view/controls.tsx#SelectControl`.

**A jsdom test cannot see any of this** (`isWeb` is always true there), so the claims are split:
`src/view/**/*.test.*` covers behaviour — the lifecycle, S1, dispatch, dependent queries — and
`metro/suites/view.tsx` covers *mounting*, on ios and android, through the real reconciler
`sdk/org/libs/ui/metro/suites/view.tsx:1-22`. The view surface is on the resolution gate's entry
(`sdk/org/libs/ui/metro/entries/surface.ts:40-45`) and its fork is in the gate's expected list
`sdk/org/libs/ui/metro/graph-gate.mjs:74-79`.

```bash
pnpm --filter @lmthing/ui test         # jsdom — behaviour
pnpm test:native                       # metro graph gate + render suites, ios AND android
```
