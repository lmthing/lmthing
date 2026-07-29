# View specs — a page as data

A project page can be authored in **two media**. The one described in [README.md](./README.md) is a React `.tsx` file. This page describes the other: a **view spec** — a plain object, validated against the project's own endpoint contracts at save time and rendered by a shared `ViewRenderer` on the web bundle **and** natively in the mobile app.

Which medium an agent can use is decided by capability, not by instruction: `pages:write` earns the TSX writers, `views:write` earns the spec writers, and they are disjoint `sdk/org/libs/core/src/typecheck/library-dts.ts#CAPABILITY_DTS_FRAGMENTS`. `system-appbuilder` writes TSX; `system-viewbuilder` writes specs and **cannot name** `writeProjectPage`, so freehand UI in a viewbuilder agent is a typecheck error rather than a policed instruction `sdk/org/libs/core/src/exec/app-globals.ts:229-231`.

The writers themselves → [../../../runtime-globals/app-authoring.md](../../../runtime-globals/app-authoring.md).

---

## Files on disk

| path | what |
|---|---|
| `pages/<route>.view.json` | one page spec `sdk/org/libs/cli/src/app/view-spec/files.ts#viewSpecPath` |
| `pages/<route>.tsx` | its **generated** wrapper — never hand-edited `sdk/org/libs/cli/src/app/view-spec/files.ts#viewWrapperPath` |
| `pages/components/<Name>.view.json` | a reusable element composition `sdk/org/libs/cli/src/app/view-spec/files.ts#viewComponentPath` |
| `pages/_shell.view.json` | the app shell (nav, brand, assistant dock) `sdk/org/libs/cli/src/app/view-spec/files.ts:44` |

The two non-route paths are chosen so the build cannot mistake them for routes: `walkPages` already skips a `components/` dir under `pages/` and any `_`-prefixed basename, and `.json` is not a page extension `sdk/org/libs/cli/src/app/build/pages.ts:232-245`.

**The wrapper is the whole trick.** Because a spec sits beside a trivial `.tsx` that renders it, the page pipeline never learns that view specs exist — discovery, content hashing, caching, the route table and the client entry are all unchanged `sdk/org/libs/cli/src/app/view-spec/wrapper.ts#renderViewWrapper`. The wrapper **inlines** the spec, the app's components and the shell, so a web page carries its own definition and fetches no spec; the native target fetches instead. A component or shell write therefore re-emits every wrapper `sdk/org/libs/cli/src/app/view-spec/files.ts#listViewRoutes`.

Three things the wrapper does that are not decoration, each of which breaks **every route** of an app when absent: it mounts `ViewThemeProvider` (a page bundle has no root that supplies the theme context `Prim.*` requires); it builds the data client **inside** the component, because ESM hoists page imports above the entry's `mountApp({ manifest })` and a module-scope client would capture an empty manifest; and it passes the router's `[param]` values through as `route`, which is what `$route.*` resolves against `sdk/org/libs/cli/src/app/view-spec/wrapper.ts#renderViewWrapper`.

Renderer improvements reach **already-built** apps through the builder-version bump, because a spec app's UI lives in the renderer rather than in its pages `sdk/org/libs/cli/src/app/build/pages.ts:100-108`.

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

**There is no `custom` kind and no React escape hatch.** A surface that cannot be expressed is *reported* by the planner; the escape hatch is one level up — `system-appbuilder` `sdk/org/libs/cli/src/app/view-spec/schema.ts:24-27`.

### Bindings are paths, never expressions

Exactly eight roots, and nothing else `sdk/org/libs/cli/src/app/view-spec/schema.ts#BINDING_PATTERN`:

`$` · `$.field` · `$props.x` · `$route.param` · `$data.<sectionId>.path` · `$result.field` · `$form.field` · `$client.timezone`

No conditionals, no arithmetic, no interpolation, no eval. Computation lives in three places instead: renderer built-ins, a **named declarative policy** (`toneMap`, `poll.while`, `merge: 'fill-empty'`), or an endpoint's Output. Two consequences are the point of the design — no app-authored code ever runs on the phone, and a weak model cannot write a broken computation in a language that has none.

`looksLikeExpression` is what lets a rejection tell "you wrote an expression" from "you mistyped a path" `sdk/org/libs/cli/src/app/view-spec/schema.ts#looksLikeExpression`.

### The view-shaped-endpoint rule

**One section, one endpoint, and the endpoint's Output must satisfy the section's bindings.** Cross-query joins and selection logic become computed Output fields, not page glue. `from` is the one relaxation: a section may source its rows from an array already embedded in an Output it (or another section) fetched, which removes a round trip rather than adding one `sdk/org/libs/cli/src/app/view-spec/schema.ts#From`.

---

## Validation — three tiers, all structured

All three return a finding list, never a verdict: exit-status ground truth, the same philosophy as `buildApp` and `smoke_endpoints`. The writers, the `system-viewbuilder` tasklist nodes and the tests all call the **same** functions `sdk/org/libs/cli/src/app/view-spec/validate.ts:1-35`.

### 1. `validateViewSpec(spec, contracts)` — save time

Runs inside `writeProjectView` before anything reaches disk `sdk/org/libs/cli/src/app/view-spec/validate.ts#validateViewSpec`. Shape first (ajv, from the pinned schema `sdk/org/libs/cli/src/app/view-spec/schema.ts#validateViewSpecShape`); if the shape is wrong the semantic checks are skipped entirely, because a model handed twenty cascading errors from one missing brace fixes none of them.

Then: every `query`/`mutation`/`prefill.endpoint`/`mutate`/`download`/`invalidates` name against the project's real endpoints **and their methods**; every `input` key against the endpoint's declared Input; every `$.field` against its Output; `$props`/`$route`/`$data`/`$result`/`$form` against their scopes; component references and their props; `reveals` and `$data.<id>` targets; `navigate` routes.

Field resolution is deliberately a **union** of the endpoint's top-level and row fields rather than an exact scope resolution `sdk/org/libs/cli/src/app/view-spec/validate.ts#outputFieldUniverse`. Being exact would need a type checker over JSON Schema, and the failure mode of getting it wrong is rejecting a spec that would have worked — the one outcome a save-time gate must never produce. An endpoint whose Output cannot be read yields `undefined` fields, which means *skip*, never *reject*.

### 2. `validateAppViews(projectRoot)` — whole app

Everything a single save cannot see `sdk/org/libs/cli/src/app/view-spec/validate.ts#validateAppViews`: a page **no navigation reaches**, a nav target that is not a route, a component nothing uses (a warning), a page with **no data-bound section**, and every artifact re-checked against the finished app's full vocabulary. The orphan check is the one that earns its keep — every page can validate, every route build and every endpoint answer while three pages have no way in.

An app with no specs reports `ok:false` and says so, because an empty finding list is precisely what a pipeline reads as "clean".

### 3. `renderSmokeViews(projectRoot, { call })` — against live data

The view twin of `smoke_endpoints`, and the only tier that can see the failure the others cannot: a page that is structurally perfect and **empty** `sdk/org/libs/cli/src/app/view-spec/validate.ts#renderSmokeViews`. It calls each section's endpoint with route parameters filled from ids real rows carry, then reports per page:

- **binding coverage** — what fraction of the page's bound fields were non-null on real rows;
- **empty-render detection** — the page produced nothing a user would see;
- **an always-null binding**, reported against the **endpoint**, not the view `sdk/org/libs/cli/src/app/view-spec/messages.ts#alwaysNullBinding`. The view named a field the contract declares, so the defect is that the endpoint never computes it; a fix routed at the page would delete the binding and call it fixed.

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
