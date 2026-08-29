# View specs — a page as data

A project page exists in **two media**. The one described in [README.md](./README.md) is a React `.tsx` file. This page describes the other — and the only one that has an author at all: a **view spec** — a plain object, validated against the project's own endpoint contracts at save time and rendered by a shared `ViewRenderer` on the web bundle **and** natively in the mobile app.

**`views:write` is the ONE UI-authoring capability, and it is the mechanism, not a policy.** It earns the spec writers (`writeProjectView`, `writeProjectViewLayout`, `writeProjectViewComponent`, `writeProjectViewShell`) `sdk/org/libs/core/src/typecheck/library-dts.ts#CAPABILITY_DTS_FRAGMENTS`. There is no freehand-TSX writer left to grant instead — the model-facing global and its capability id were removed from the codebase entirely, so "author a page" has exactly one shape now, for every agent, not a rule `system-appbuilder` happens to follow `sdk/org/libs/core/src/exec/app-globals.ts#injectAppGlobals`. TSX pages are still SERVED — the store catalog ships them (`store/projects/blog/pages/index.tsx`) through the legacy per-project build — but a view spec is never compiled to TSX; it is rendered at runtime by the shared `ViewRenderer`, and nothing writes a new hand-authored page.

The writers themselves → [../../../runtime-globals/app-authoring.md](../../../runtime-globals/app-authoring.md).

---

## Files on disk

| path | what |
|---|---|
| `views/<route>.view.json` | one page spec `sdk/org/libs/cli/src/app/view-spec/files.ts#viewSpecPath` |
| `views/<prefix>/_layout.view.json` | a nested layout frame `sdk/org/libs/cli/src/app/view-spec/files.ts#viewLayoutPath` |
| `components/<Name>.view.json` | a reusable element composition `sdk/org/libs/cli/src/app/view-spec/files.ts#viewComponentPath` |
| `shell.view.json` | the app shell (nav, brand, assistant dock) `sdk/org/libs/cli/src/app/view-spec/files.ts#SHELL_SPEC_PATH` |

The v1 layout (`pages/**/*.view.json`, `pages/components/`, `pages/_shell.view.json`) is still read for existing projects `sdk/org/libs/cli/src/app/view-spec/files.ts#loadProjectViews`.

**A spec is never compiled — it is fetched and rendered at runtime.** Both hosts read the specs from the same transport, `GET /api/apps/:id/views` (`sdk/org/libs/cli/src/server/routes/app-views.ts#handleAppViews`): the web AppHost (`sdk/org/apps/app-shell/src/app-host.tsx#AppHost`) and the native mobile app (`sdk/org/apps/mobile/src/app-views.ts`). There is no per-page `.tsx` and no per-project bundle, so a write of a view, component, shell or layout lands exactly one artifact — the next fetch composes the whole app afresh.

`ViewThemeProvider`, the data client and the router's `[param]` values are the renderer's own responsibility, mounted once by the AppHost (and by the native screen), not per page — each was a live source of "breaks every route" bugs back when a generated wrapper had to reproduce it, and each is now owned in one place `sdk/org/apps/app-shell/src/app-host.tsx#AppHost`.

Renderer improvements reach **every** spec app at once: its UI lives in the prebuilt shell and the fetched specs, not in a per-project build, so a fixed renderer is served to all of them with no rebuild `sdk/org/apps/app-shell/src/app-host.tsx#AppHost`.

---

## The shape

A page is `{ route, title?, layout?, sections }` `sdk/org/libs/cli/src/app/view-spec/schema.ts#ViewSpec`. Everything but `route` and `sections` is optional, and **every omission is a renderer default, not a gap** — the minimum valid section is `{ kind: 'list', query: 'X' }`.

**Eight section kinds, and the union is full** `sdk/org/libs/cli/src/app/view-spec/schema.ts#SECTION_KINDS`:

| kind | what it is |
|---|---|
| `list` | a collection `sdk/org/libs/cli/src/app/view-spec/schema.ts#ListSection` |
| `detail` | one record `sdk/org/libs/cli/src/app/view-spec/schema.ts#DetailSection` |
| `create` | a form — **fields are derived from the mutation's Input schema, never declared** `sdk/org/libs/cli/src/app/view-spec/schema.ts#CreateSection` |
| `stats` | a metrics strip `sdk/org/libs/cli/src/app/view-spec/schema.ts#StatsSection` |
| `markdown` | prose, literal or bound `sdk/org/libs/cli/src/app/view-spec/schema.ts#MarkdownSection` |
| `chat` | an assistant dock `sdk/org/libs/cli/src/app/view-spec/schema.ts#ChatSection` |
| `toolbar` | mode toggles and actions `sdk/org/libs/cli/src/app/view-spec/schema.ts#ToolbarSection` |
| `timeline` | a date-grouped stream `sdk/org/libs/cli/src/app/view-spec/schema.ts#TimelineSection` |

Section slots take an element tree, a component reference (`{ use: 'RecipeCard', props: … }`), or the flat convenience form (`item: { title: '$.name' }`) `sdk/org/libs/cli/src/app/view-spec/schema.ts#Slot`. The element catalogue is 24 kinds and is likewise closed `sdk/org/libs/cli/src/app/view-spec/schema.ts#ELEMENT_KINDS`.

Every text-ish key of the flat form takes a string **or** that string with its modifiers attached — `{ value, format?, currencyField?, tone?, toneMap?, suffix?, maxLines? }` `sdk/org/libs/cli/src/app/view-spec/schema.ts#FlatValue`. `suffix` is how a value carries a unit (`meta: { value: '$.prepMinutes', suffix: 'min' }` renders "20 min"); it lives on that one shared definition rather than as a `metaSuffix`/`captionSuffix` key family, which is the key explosion the object form exists to prevent.

`chat.agent` is an agent **slug** — kebab-case, the naming style every agent in this codebase uses (`pantry-keeper`, `data-modeler`) `sdk/org/libs/cli/src/app/view-spec/schema.ts#AGENT_NAME_PATTERN`. The pattern is deliberately thin: its job is to keep a URL or a sentence out of the field, and whether the agent *exists* is not a shape question.

**There is no `custom` kind and no React escape hatch — and no builder to escape to.** A surface this vocabulary cannot express is *reported* by the planner and carried, verbatim, all the way out to the user by `finalize`; naming the gap is the correct answer, and forcing the surface into the nearest section kind is the failure that answer exists to prevent `sdk/org/libs/cli/src/app/view-spec/schema.ts:24-27`.

### Bindings are paths, never expressions

Exactly eight roots, and nothing else `sdk/org/libs/cli/src/app/view-spec/schema.ts#BINDING_PATTERN`:

`$` · `$.field` · `$props.x` · `$route.param` · `$data.<sectionId>.path` · `$result.field` · `$form.field` · `$client.timezone`

No conditionals, no arithmetic, no interpolation, no eval. Computation lives in three places instead: renderer built-ins, a **named declarative policy** (`toneMap`, `poll.while`, `merge: 'fill-empty'`), or an endpoint's Output. Two consequences are the point of the design — no app-authored code ever runs on the phone, and a weak model cannot write a broken computation in a language that has none.

`looksLikeExpression` is what lets a rejection tell "you wrote an expression" from "you mistyped a path" `sdk/org/libs/cli/src/app/view-spec/schema.ts#looksLikeExpression`.

### An argument is a constant **or** a binding

Every argument map — a section's `input`, `mutate.input`, `navigate.params`, `link.params`, `create.prefill.input`, and the endpoint-side `x-options.input` — takes an **`Arg`**: a binding path, or a constant `string`/`number`/`boolean` `sdk/org/libs/cli/src/app/view-spec/schema.ts#Arg`. So `{ id: '$.id', meal: 'dinner', withinDays: 7 }` is one object, and a number stays a number all the way to the request `sdk/org/libs/ui/src/view/bind.ts#resolveInputs`.

A string argument is graded by the same pattern every other authored string is graded by, so a literal stays distinguishable from a path and an embedded binding (`'/trips/$result.id'`) is still an error `sdk/org/libs/cli/src/app/view-spec/schema.ts#VALUE_PATTERN`. A constant is a **scalar** — an object or an array is a type error — so this adds no expression power.

It is load-bearing rather than a convenience: **one endpoint called with different constants** (three buttons, one `explain` mutation, `tldr` / `eli5` / `why-me`) is an ordinary shape, and moving the constant into the endpoint's Input default — the only workaround while arguments were paths-only — works for exactly one value per endpoint.

### The view-shaped-endpoint rule

**One section, one endpoint, and the endpoint's Output must satisfy the section's bindings.** Cross-query joins and selection logic become computed Output fields, not page glue. `from` is the one relaxation: a section may source its rows from an array already embedded in an Output it (or another section) fetched, which removes a round trip rather than adding one `sdk/org/libs/cli/src/app/view-spec/schema.ts#From`.

---

## Validation — three tiers, all structured

All three return a finding list, never a verdict: exit-status ground truth, the same philosophy as `buildApp` and `smoke_endpoints`. The writers, the `system-appbuilder` tasklist nodes and the tests all call the **same** functions `sdk/org/libs/cli/src/app/view-spec/validate.ts:1-35`.

### 1. `validateViewSpec(spec, contracts)` — save time

Runs inside `writeProjectView` before anything reaches disk `sdk/org/libs/cli/src/app/view-spec/validate.ts#validateViewSpec`. Shape first (ajv, from the pinned schema `sdk/org/libs/cli/src/app/view-spec/schema.ts#validateViewSpecShape`); if the shape is wrong the semantic checks are skipped entirely, because a model handed twenty cascading errors from one missing brace fixes none of them.

Then: every `query`/`mutation`/`prefill.endpoint`/`mutate`/`download`/`invalidates` name against the project's real endpoints **and their methods**; every `input` key against the endpoint's declared Input; every `$.field` against its Output; `$props`/`$route`/`$data`/`$result`/`$form` against their scopes; component references and their props; `reveals` and `$data.<id>` targets; `navigate` routes; and a qualified `chat.agent` against the project's real agents `sdk/org/libs/cli/src/app/view-spec/validate.ts#loadProjectAgents`.

A **`navigate` target that is not yet a route is a warning at save time and an error app-wide** `sdk/org/libs/cli/src/app/view-spec/messages.ts#unknownRoute`. `recipes` links to `recipes/[id]` and `recipes/[id]` links back, so whichever page is written first names a route that does not exist — **no write order satisfies both**, and a hard failure there is a writer no model can satisfy. Nothing is lost: `validateAppViews` re-runs the identical resolution against every route on disk `sdk/org/libs/cli/src/app/view-spec/validate.ts#validateAppViews`.

`chat.agent` resolves only when the section also names a `space`, since a bare slug is the project's own top-level agent — dispatched as `agentSlug`, not `spaceRef` `sdk/org/libs/ui/src/view/sections/chat.tsx#sessionBody` — and nothing on disk enumerates those. A project with no `spaces/` dir skips the check rather than failing it.

At render time the section both creates the session AND opens its socket against the **pod origin** — `podOrigin(client.baseUrl)`, which strips the `…/app/<project>` suffix off the client's app base `sdk/org/libs/ui/src/view/sections/chat.tsx#ChatSectionView` · `sdk/org/libs/ui/src/view/client.ts#podOrigin`. The socket URL had used the raw app base, resolving the non-existent `…/app/<project>/api/ws`, so the dock hung on "Connecting…"; and a transport error is kept off the wire-error channel so a failed handshake no longer renders as a literal "undefined" `sdk/org/libs/ui/src/chat/client/rpc-client.ts#ReplRpcClient`.

`section.height` (`sm`/`md`/`lg`/`full` → 240/360/520/720px, `sdk/org/libs/ui/src/view/sections/chat.tsx#HEIGHTS`) is an UPPER bound, not a literal size — `sm`/`md`/`lg` (a small widget dropped mid-page) shrink via `clampDockHeight`, which fits the preset under the actual viewport height (measured through the `platform/dimensions` seam, not a CSS media query, so the same clamp holds on native) minus a fixed allowance for whatever chrome sits above/below the dock `sdk/org/libs/ui/src/view/sections/chat.tsx#clampDockHeight`. Before this, `full` was a literal 720px `Prim.Box` height regardless of viewport — the default project's "app-from-birth" index view ships `height: "full"` as its one section, so the composer and suggestion chips were pushed below the fold on any window under roughly 950px tall (confirmed on a 390×844 phone and even a 1280×800 laptop).

`full` gets an EXACT fit on the web rather than the same allowance-based estimate: a `getBoundingClientRect()` on the dock's own box (`sdk/org/libs/ui/src/view/sections/chat.tsx#ChatSectionView`, the `boxRef`/`topOffset` state) measures exactly where its top landed — under whatever the page actually puts above it (nav bar, title, a greeting that may wrap to a different number of lines) — and `exactDockHeight` sets the box's height so its bottom lands exactly at the bottom of its enclosing scroll region, with a small fixed gutter and no page scroll at all `sdk/org/libs/ui/src/view/sections/chat.tsx#exactDockHeight`. That bound is deliberately **not** `window.innerHeight`: `ViewShell` wraps every page's content in its own `<Prim.Scroll flexGrow={1} minHeight={0}>`, sized by flexbox against whatever ELSE shares that flex column — a top bar, and on a phone a bottom tab bar sitting in normal flow, past the scroll region, not as a `position: fixed` overlay `sdk/org/libs/ui/src/view/shell.tsx#ViewShell`. Subtracting only a fixed gutter from the raw window height ignored the tab bar entirely and let the composer land underneath it: present in the DOM and the accessibility tree, unclickable, invisible — the same class of failure `shell-height.test.tsx` documents for a shell that collapses to its content instead of declaring a real height. `findScrollBoundBottom` climbs from the box to the nearest `overflow-y: auto|scroll` ancestor (`ViewShell`'s own `Prim.Scroll`) and uses ITS bottom edge instead `sdk/org/libs/ui/src/view/sections/chat.tsx#findScrollBoundBottom`; falling back to `window.innerHeight` only if no such ancestor is found. Measured in a `useLayoutEffect` (pre-paint, no flash of a wrong size) and re-measured on window resize; re-runs when the greeting text changes since that can change how many lines it wraps to. The native target has no DOM to measure (`typeof document === 'undefined'`), so `full` there still uses the `clampDockHeight` allowance estimate.

Field resolution is deliberately a **union** of the endpoint's top-level and row fields rather than an exact scope resolution `sdk/org/libs/cli/src/app/view-spec/validate.ts#outputFieldUniverse`. Being exact would need a type checker over JSON Schema, and the failure mode of getting it wrong is rejecting a spec that would have worked — the one outcome a save-time gate must never produce. An endpoint whose Output cannot be read yields `undefined` fields, which means *skip*, never *reject*.

Three consequences of that rule, each one a measured false rejection:

- The universe **follows `$ref` into `definitions`**, because `export type Output = Recipe[]` — the commonest Output shape — generates a root whose only property names are `type`/`items`/`definitions` `sdk/org/libs/cli/src/app/view-spec/validate.ts#outputFieldUniverse`. A reader that stopped there saw zero fields and rejected every binding on the endpoint.
- An Output that resolves to **zero** fields yields `undefined`, never `[]`. `EndpointContract` uses an empty-object schema both for *declares no Output* and for *could not be read*, so `[]` would reject every binding on an endpoint whose contract merely went stale `sdk/org/libs/cli/src/app/build/schema.ts#EndpointContract`.
- The **synchronous** reader the writers use expands a named element type declared beside the handler, and returns `undefined` — not a partial list — when it cannot `sdk/org/libs/cli/src/app/view-spec/validate.ts#loadViewContracts`. A partial menu is worse than none: it rejects, and it rejects with confident advice. For the same reason a `from`-scoped section skips the field check entirely there, because that reader carries no schema to re-root against.

### 2. `validateAppViews(projectRoot)` — whole app

Everything a single save cannot see `sdk/org/libs/cli/src/app/view-spec/validate.ts#validateAppViews`: a page **no navigation reaches**, a nav target that is not a route, a component nothing uses (a warning), a page with **no data-bound section**, and every artifact re-checked against the finished app's full vocabulary. The orphan check is the one that earns its keep — every page can validate, every route build and every endpoint answer while three pages have no way in.

An app with no specs reports `ok:false` and says so, because an empty finding list is precisely what a pipeline reads as "clean".

### 3. `renderSmokeViews(projectRoot, { call })` — against live data

The view twin of `smoke_endpoints`, and the only tier that can see the failure the others cannot: a page that is structurally perfect and **empty** `sdk/org/libs/cli/src/app/view-spec/validate.ts#renderSmokeViews`. It resolves each section's inputs the way the renderer does — `$data.<section>.path` from the section above it, `$client.timezone`, and route parameters from ids real rows carry — then reports per page:

- **binding coverage** — what fraction of the page's bound fields were non-null on real rows;
- **empty-render detection** — the page produced nothing a user would see;
- **an always-null binding**, reported against the **endpoint**, not the view `sdk/org/libs/cli/src/app/view-spec/messages.ts#alwaysNullBinding`. The view named a field the contract declares, so the defect is that the endpoint never computes it; a fix routed at the page would delete the binding and call it fixed.

Three things it does *not* do, each because doing them produced a confidently wrong finding:

- It never measures a section against a **guess** at its rows. The scope is the section's own source — `from`, or `rows` for a `list`/`timeline` and the record for everything else, mirroring `sdk/org/libs/ui/src/view/sections/common.tsx#useSectionSource`. Taking "the first array-valued property" instead reported fourteen correct bindings on one kitchen page as always-null, each naming the wrong endpoint.
- A **non-2xx response is never data** `sdk/org/libs/cli/src/app/view-spec/validate.ts#renderSmokeViews`. An error body counted as one row is how a page whose every endpoint 4xx'd reported as populated.
- **Zero checked bindings is not 100%.** `coverage` and `empty` are `null` for a page nothing could be measured on, which is a third answer distinct from both 0% and 100% `sdk/org/libs/cli/src/app/view-spec/validate.ts#ViewSmokeReport`; the sections that could not be reached are listed in `unmeasured`. Defaulting them to `1`/`false` made the headline metric read perfect exactly where the app was most broken.

Route parameters come from an id pool **scoped to the collection that produced them** — the value for `/plan/:id/trip` comes from `/plan`, never from `/pantry` `sdk/org/libs/cli/src/app/view-spec/validate.ts#ViewEndpoint`. A flat pool let one entity's id smoke another's page and 404.

With no api caller it reports `unavailable: true` rather than a clean run, and `rendererMounted` says whether the real `ViewRenderer` was additionally mounted — never inferred from an empty finding list.

---

## Menu-shaped errors

Every rejection names the instance path, the offence and the finite valid set `sdk/org/libs/cli/src/app/view-spec/messages.ts:1-35`:

```
sections[1].mutation: "addRecipies" is not an endpoint. Did you mean addRecipe?
Mutations: addRecipe, importRecipe, importRecipeText
```

```
sections[0].item.title: "$.price * $.qty" is not a binding — the spec language has no
expressions, on purpose. Bindings are paths only. Compute the value in the endpoint's Output
and bind the result, or use a named policy: format (currency/date/relative-time/number),
toneMap (value → tone), poll.while (refresh while a field is in a set).
```

```
sections[0].param: "$params.id" is not a valid binding. Did you mean "$route.id"? Bindings are
paths from one of eight roots: $ (the current row/record), $.field, $props.name (inside a
component), $route.param, $data.<sectionId>.path (another section on this page), $result.field
(under onSuccess), $form.field (under create.prefill.input), $client.timezone.
```

The last two are the same `$`-shaped string to a pattern matcher and **different failures** to a model: one needs an endpoint change, the other needs one token `sdk/org/libs/cli/src/app/view-spec/messages.ts#classifyBadBinding`. A mistyped root that edit distance cannot reach (`$params` is five edits from `$route`) is mapped explicitly, because these are framework conventions rather than typos `sdk/org/libs/cli/src/app/view-spec/messages.ts#badBindingRoot`.

This text is a **model-facing interface**: the tests assert it verbatim, and changing a message is a contract change `sdk/org/libs/cli/src/app/view-spec/validate.test.ts:1-8`.

---

## `x-options` — where a foreign-key field's options come from

A `create` section declares no fields, so "what should this select offer" has nowhere to live except the mutation's own Input contract. It is a JSON-Schema annotation on an Input property, written as JSDoc `sdk/org/libs/cli/src/app/view-spec/schema.ts#XOptions`:

```ts
// api/expenses/POST.ts
export interface Input {
  amount: number
  /** @x-options {"query":"listTravelers","label":"$.name","value":"$.id"} */
  paidByTravelerId: string
}
```

The generator is told to carry the tag through instead of dropping it `sdk/org/libs/cli/src/app/build/schema.ts:295-297`, malformed annotations are dropped rather than thrown `sdk/org/libs/cli/src/app/build/contracts.ts#collectFormOptions`, and the keyword is registered with the input ajv so an annotated schema still compiles `sdk/org/libs/cli/src/app/build/validate.ts:38-49`. Without the carry-through a foreign-key field renders as a raw UUID text box.
