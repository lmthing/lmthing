# App builder v2 — `system-viewbuilder`: change plan, live-test plan, improvement loop

> The approved plan, in the repo. Live status of its execution is in
> [`PROGRESS.md`](../PROGRESS.md) at the repo root; the previous plan this one replaced (the team
> surface, since shipped) is archived at [`design/teams-mobile-progress.md`](./teams-mobile-progress.md).

## Context

Owner intent: make app building produce better apps with a DeepSeek-class model on the cheap
slots, without capping what complex apps can be — and with one defining capability: **the new
builder's apps render NATIVELY in the mobile app, no WebView.**

**Strategy (owner decision 2026-07-29): `system-appbuilder` is FROZEN — not one line of it
changes.** The view-spec pipeline ships as a NEW sibling system space, **`system-viewbuilder`**,
with the same tasklist entry point (`build_live_project`, same `{query, attachmentIds}` input), so
the two builders are interchangeable at the single routing seam: THING's hardcoded
`delegate('system-appbuilder', 'automator', 'build_live_project', …)`
(`user-thing/agents/thing/instruct.md`, 6 call sites).

**Routing is explicit opt-in (owner decision):** THING delegates to `system-viewbuilder` ONLY when
the user explicitly asks for a spec-based app; `system-appbuilder` remains the default for every
other build. That is one added routing rule + one delegate example in THING's instruct — no
appbuilder change, no default-path change. Whether the viewbuilder ever becomes the default is a
separate, later owner decision, taken on A/B evidence — not part of this plan's scope.

Grounding (measured 2026-07-29):

- 6 catalog apps: pages 11,784 LOC · components 11,688 LOC · api 13,911 LOC → **UI is 63% of every
  app and the least creative 63%**.
- 84 content pages · 124 queries · **139 mutations** · only 33 pages read-only → mutations are the
  majority; any page spec must make them first-class.
- ~90% of pages decompose into standard *sections* (list, detail, create/form, stats, markdown,
  chat, toolbar); ~8/84 pages are genuinely bespoke (timeline, map, compare, cooking-mode).
- The appbuilder pipeline *instructs* per-app reinvention: `06-plan_components.md:15` tells the
  model to design a `Card`, `Row`, `Badge`, `StatTile`, `EmptyState` — explaining the 140
  hand-built components (26 cards, 21 rows, 13 loading/empty states, 13 bars/meters, 8 badges)
  across 5 apps.
- Its worst failure class (06-tanzania run 34: dead app via `apiHandler`, `data.items`,
  `.mutateAsync`) and its heaviest defensive machinery (ok-list cross-check, `<Name>Props`
  contract ambient, dangling-import bricking warnings) are all artifacts of freshly authored,
  string-assembled TSX.
- Already in the codebase, reusable: per-endpoint JSON-Schema Input contracts + ajv validators
  (`sdk/org/libs/cli/src/app/build/contracts.ts#generateProjectContracts`), the 42-type descriptor
  renderer (`sdk/org/libs/ui/src/chat/components/render-descriptor.tsx`), schema→form precedent
  (`sdk/org/libs/ui/src/elements/forms/settings-schema-form`), `BUILDER_VERSION` cache
  invalidation (`sdk/org/libs/cli/src/app/build/pages.ts#BUILDER_VERSION`), and the scenario
  runner + lmauto judge campaign.

Core idea: **pages become specs** — an object of typed sections validated against the project's
endpoint contracts at save time and rendered by a shared `ViewRenderer` — while **data/behavior
stays real code** (tables, endpoints, automations). The model emits specs as TypeScript object
literals (trailing commas/comments legal), never JSON strings and never string-assembled TSX.

**The main concept (owner directive): native rendering.** A spec is data, so the mobile app can
fetch it and render it with the same `ViewRenderer` the web uses, built on the `Prim.*` primitives
that already fork per target (the proven team-surface pattern; `render-descriptor` is already
native-tested in `libs/ui/metro/suites/descriptor.tsx`). This is the one thing NO amount of
improvement to the TSX-authoring appbuilder can ever produce — its output is an esbuild browser
bundle, WebView-bound forever (`AppScreen.tsx` today). The appbuilder keeps the web-bundle world.

**No custom code (owner directive): everything is built ONLY from the available native building
blocks.** No per-section React escape, no `writeProjectPage` full-page escape in this builder —
its output is 100% spec, 100% natively rendered, **zero WebView by construction**.

**Reusable components DO exist (owner refinement) — as specs, not code.** Three vocabulary tiers:
1. **elements** — the base building blocks (text, badge, row, col, image, icon, meter, keyvalue,
   statcard, …): a curated subset of the descriptor renderer's already-native-tested 42-type
   vocabulary;
2. **components** — named, parameterized compositions of elements ONLY (`RecipeCard`,
   `SeverityPill`), spec fragments with declared `$props`, written via their own validated writer;
   may reference elements and other components (acyclic), never React, never HTML;
3. **sections** — the page-level patterns; their slots (a list's `item`, a detail body, a
   dashboard card) accept elements or component references.
Because a component is data, it needs no bundling, loads natively for free, and is validated
exactly like a view — props checked at every use site, bindings checked against endpoint fields.

Two consequences, both intended: the **vocabulary is the ceiling**, raised only by the improvement
loop promoting new kinds (built by us, token-styled, metro-tested, retroactive via
`BUILDER_VERSION`); and the escape hatch moves UP a level — a request that genuinely needs bespoke
UI is what `system-appbuilder` remains for. For a DeepSeek-class model this is the strongest
possible configuration: there is no medium left in which UI can be authored incorrectly.

---

## Part 1 — What changes

### Workstream B — The spec engine (`@lmthing/cli` + `@lmthing/ui`)

**B1. Spec schema** — `sdk/org/libs/cli/src/app/view-spec/schema.ts`: TS types + a JSON Schema
(ajv). Page = `{ route, title?, sections: Section[] }`. **v1 section kinds, capped at 8:**

| kind | replaces | key fields |
|---|---|---|
| `list` | ~38 pages' core | `query`, `item` bindings (`$.field`), `layout: cards\|rows\|table`, `facet`, `search`, `limit`, `rowAction`, `empty` |
| `detail` | ~20 pages' core | `query` (+`param`), `fields`/`keyvalue`, `header`, `actions` |
| `create` | the 139 mutations' forms | `mutation`, fields **derived from the endpoint's Input schema** (never declared), `invalidates`, `async{note,refetchAfter}`, `prefill{endpoint,from,merge:'fill-empty'}` |
| `stats` | 9 dashboards' strips | `query`, `cards: [{label, value: $.field, meter?}]` |
| `markdown` | static/doc sections | `source` or `query`+binding |
| `chat` | 4 assistant docks | `agent` (wraps the existing `<Chat>`) |
| `toolbar` | mode-toggle headers | `reveals: [sectionId]`, `actions` |
| *(8th slot)* | strongest T0-evidenced bespoke shape | decided at T0 — leading candidate `timeline` (the descriptor renderer already has a `timeline` case) |

No `custom` kind (owner directive).

**Layout prediction — common layouts are PREDICTED, not authored.** Two levels, both defaulted by
heuristics the model can override but should rarely need to:

- **App shell** (replaces `_app.tsx`/`_layout.tsx`, which every catalog app hand-writes today): a
  top-level `shell` spec — nav entries, icons (named set), brand line — **derived automatically
  from the route list** when absent: top-level pages become nav items; presentation is
  target-predicted (bottom tabs on phone — the `BottomTabs` element exists for exactly this;
  top bar or sidebar on web, chosen by nav count). Validated like everything else (every nav
  target must be a real route).
- **Page archetypes**: a page's `layout` field is optional; when absent the renderer predicts the
  archetype from its section composition —
  `stats + several lists` ⇒ **dashboard** (stats strip on top, responsive grid below);
  `single list (+toolbar)` ⇒ **list page** (toolbar, facets, full-width list);
  `detail + related lists` ⇒ **detail page** (header, keyvalue, sub-sections);
  `list + detail on the same data` ⇒ **master-detail** (split on wide screens, drill-in on phone);
  `create-only` ⇒ **form page** (centered, constrained width).
  Responsive behavior lives INSIDE the archetypes (cards→rows on a phone, grid columns collapsing,
  split panes becoming navigation) via the Tamagui media breakpoints already aligned to Tailwind's
  — the model never writes a breakpoint.

The prediction quality is measurable: the **layout-override rate** (how often the model must set
`layout`/`shell` explicitly) joins the ratchet metrics — low means the predictions are right;
rising means the heuristics need work, not the model more rope.

Element grammar + component defs in the same schema: element
nodes (`{ el: 'badge', text: '$.status', tone: 'auto' }`, composable via `row`/`col`); component
defs (`{ name: 'RecipeCard', props: { recipe: 'Recipe' }, node: … }`, props typed against
`@app/types` row types); section slots accept an element tree, a component reference
(`{ use: 'RecipeCard', props: … }`), or the flat convenience form (`item: { title: '$.name' }`).
Every field optional with a renderer default; minimum valid section is `{kind:'list', query:'X'}`.

**The element catalog must be complete enough for complex application UIs (owner directive) — and
completeness is AUDITED, not assumed.** The v1 catalog (~26 elements, floor = the descriptor
renderer's proven types, which already include `statcard`/`timeline`/`progressbar`/`keyvalue`/
`table`/`columns`/`banner`):

| group | elements |
|---|---|
| layout | `row` · `col` · `grid` · `spacer` · `divider` · `surface` (card-like container) |
| typography | `heading` · `text` · `caption` · `code` · `markdown` · `quote` |
| data display | `badge` · `chip` · `statcard` · `meter` (bar/progress/score) · `keyvalue` · `table` · `timeline` · `avatar` · `rating` |
| media | `image` · `icon` (the named set) · `map` (static map image — `homes/StaticMap` precedent) |
| feedback | `banner` (info/warn/error tones) · `empty` |
| interactive | `button` (action = `{mutate}`/`{navigate}` refs — names only, like everything) · `link` |

Formatting is a modifier, not an element: `format: 'currency'|'date'|'relative-time'|'number'` on
any bound value (absorbing the 5/5-apps `format.ts`).

**The completeness audit** (Wave 0, blocking schema pinning): every one of the **140 surveyed
hand-built components** across the 5 catalog apps must be expressible as an element composition —
each is mapped to its element tree on paper; any visual that cannot be expressed is an element gap
that either extends the catalog NOW or is explicitly recorded as out of scope (with the appbuilder
named as its home). Known deliberate exclusions, recorded up front: charts beyond `meter`
(`MetricChart` appears once in 140 — promotable later, not v1), drag-and-drop interactions, and
free-form canvases. The audit artifact ships in the repo next to the schema so bucket-1 promotions
later have the baseline.

**The spec language is deliberately NOT Turing-complete.** Bindings are paths (`$.field`,
`$props.x`) — never expressions, never conditionals, never eval. Computation lives in exactly
three places: renderer built-ins (facets, `format:` hints), named declarative policies
(`merge: 'fill-empty'`), or an endpoint's Output (typed, smoke-tested, pod-side, identical on both
targets; form coercion/validation is the Input schema's job). Consequences: **no app-authored code
ever executes on the phone** (the phone runs only the precompiled renderer + client and reaches
all custom TypeScript — handlers, automations — on the pod over HTTP); a weak model cannot write a
broken computation in a language that has none; no dynamically downloaded executable logic on the
device. A spec that "needs an if" gets a menu-shaped rejection pointing at a built-in or at the
endpoint layer.

**The view-shaped-endpoint rule** (verified against the hardest shipped page,
`store/projects/kitchen/pages/index.tsx`: 5 queries, 2 dependent, 9 mutations — whose heavy
transforms are ALREADY server-side; the residual client code is misfit absorption): **one section,
one endpoint, and the endpoint's Output must satisfy the section's bindings.** Selection logic and
cross-query joins become computed Output fields. Two spec features this forces (in B1's budget):
- **dependent-query inputs** — `input: { id: '$data.currentPlan.plan.id' }`; the renderer resolves
  the query DAG, an unresolved binding means disabled (replacing hand-coded `enabled:`);
- **`limit`** on list sections.
One honest v1 loss: hand-rolled optimistic-UI state becomes per-row pending treatment; a true
optimistic-swap policy is a later promotion. Client timezone for date-dependent selections passes
as an endpoint param.

**B2. Renderer** — **`sdk/org/libs/ui/src/view/`** (NOT cli-local: it must be importable by the
mobile app), composed from `Prim.*` and the `elements/*` catalog, `.native.tsx` forks only where
targets genuinely diverge. Native-first decides the medium: `Prim.*`, no token-class-HTML
fallback. Owned consequences:
- **dual consumption** — web: the generated wrapper page bundles it (re-exported through
  `@app/runtime`; `<Chat>` already proves `@lmthing/ui` bundles into page apps); native: the
  mobile app imports it directly and feeds it a fetched spec;
- **parameterized data client** — `{ baseUrl, getToken }` (the `createTeamClient` precedent): web
  passes the app base; native passes the absolute pod URL + token (`apps/mobile` `hosts.ts` /
  `teamTokenGetter` precedents);
- **bundle-size measurement** on one golden app — informational, not a fork in the road;
- **native test surface from day one** — metro graph gate + render suites per section kind in
  `libs/ui/metro/suites/` (known traps: `render()` returns a wrapper not the tree; bare strings in
  a View are silently dropped; lucide is web-only).
Form fields render from the endpoint's Input schema via the `SettingsSchemaForm` pattern; must
handle enums (selects) and **array-of-object fields** (repeating row groups — required by
`homes/new.tsx`'s commute targets). Supplies loading/error/empty, responsive layout, a11y, tokens
— omissions become defaults, not gaps.

**B3. Writers** — in `sdk/org/libs/cli/src/app/authoring/globals.ts`, gated by `pages:write` (DTS
fragments in `sdk/org/libs/core/src/typecheck/library-dts.ts`):
- `writeProjectView(route, spec)`: (1) ajv-validate shape; (2) cross-check every
  `query`/`mutation`/`prefill.endpoint` name and every `$.field` binding against
  `ProjectContracts`; (3) **menu-shaped errors** — every rejection names the instance path, the
  offense, and the finite valid set (`sections[1].mutation: "addRecipies" is not an endpoint. Did
  you mean addRecipe? Mutations: addRecipe, importRecipe, importRecipeText`); (4) on pass, persist
  `pages/<route>.view.json` AND host-generate the trivial wrapper `pages/<route>.tsx`
  (`export default () => <ViewRenderer spec={…}/>`, spec inlined) — **zero changes to
  `walkPages`/hashing/caching**; bump `BUILDER_VERSION`.
- `writeProjectViewComponent(name, def)`: validates elements/known-components only (acyclic),
  props declared and typed; every view referencing a component validates the reference + props at
  ITS save. Components stored beside the views, served by the same spec-fetch route.
Replaces, for spec pages: `wouldDropData`, the save-time TSX lint, and the ok-list
dangling-import hazard (specs have no imports).

**B4. Api calls, end to end.** The api layer is UNTOUCHED — handlers stay real TypeScript
(`api/<route>/<METHOD>.ts`, worker-isolated, ajv-validated pod-side, smoke-tested). Only how the
UI reaches them changes: specs name endpoints (never URLs or fetch code) → save-time resolution
against `ProjectContracts` (a spec that saves is contract-consistent by construction) → runtime
lookup via the endpoint manifest (web: injected `window.__APP_ENDPOINTS__` as today; native: in
the `GET /api/apps/:id/views` payload) → one parameterized client with today's `buildRequest`
semantics (`:param` fill; GET/DELETE → query string; POST/PATCH/PUT → JSON body). The renderer
owns the `useApi` lifecycle it replaces: fetch on mount/param change, last-write-wins stale-drop,
invalidation registry keyed by endpoint name, `refetchAfter`, per-section `isPending`/`error`.

**B4b. Validation functions — deterministic host checks on what the agent creates.** Three tiers,
all plain functions returning structured error lists (exit-status ground truth, never model
self-assessment — the same philosophy as `buildApp`/`smoke_endpoints`), exported from
`sdk/org/libs/cli/src/app/view-spec/validate.ts` so the writer, the tasklist nodes, and tests all
call the SAME code:

1. **`validateViewSpec(spec, contracts)`** — per-artifact, save-time (what B3's writers run):
   shape, name resolution, binding/prop checks, menu-shaped errors.
2. **`validateAppViews(projectRoot)`** — whole-app, post-implementation: every route reachable
   from the shell nav (no orphan pages); every nav target exists; every defined component
   referenced by some view (dead component = warning); every view's endpoints present in the
   manifest; every page has ≥1 data-bound section; `reveals`/`rowAction`/`prefill` targets all
   resolve app-wide.
3. **`renderSmokeViews(projectRoot)`** — the view twin of `smoke_endpoints`, closing the gap
   static checks can't: **mount every view spec against the app's LIVE endpoint responses** (the
   seeded rows from `writeProjectTable`) using the real `ViewRenderer` headlessly, and report
   per-page: render errors, binding coverage (% of bound fields non-null on real data), and
   empty-render detection (a page that renders but shows nothing — the "structurally-valid zeros"
   failure, which passes every static gate). A binding that is contract-valid but always null in
   practice is a real defect the model must fix (usually: the endpoint's computed field isn't
   computed).

**B5. Tests** — validator unit tests asserting the menu-shaped error TEXT (part of the model
interface); jsdom render tests per section kind; a `pages.test.ts`-style build test proving a spec
page bundles; rejection tests (bad endpoint, bad `$.field`, bad component ref, dropped-query
rewrite); client tests for both `{ baseUrl, getToken }` configurations; metro render suites from
day one.

### Workstream C — The new space: `system-viewbuilder`

New sibling under `sdk/org/libs/core/system-spaces/system-viewbuilder/`, shipping and
auto-adopting like every other system space. `system-appbuilder` untouched.

- **Copied verbatim** (the data/behavior half): `01-read_sources`, `02-user_stories`,
  `03-plan_app`, `04-plan_tables`, `05-plan_endpoints`, `07a-plan_automations`,
  `07b-plan_acceptance`, `09-emit_types`, `10-implement_tables`, `11-reconcile_tables`,
  `12-implement_endpoints`, `13-smoke_endpoints`, `13a-check_acceptance`,
  `15a-implement_automations`, plus `data-modeler`/`api-author` agents. Divergence risk accepted
  for v1; extraction refactor only after the race verdict.
- **New UI nodes** (replacing `06/07/14/15`'s TSX flow):
  - `plan_views` — per-page section plans (kind + endpoint refs), lightweight;
  - `validate_contract` (the copy) gains view checks: every section's endpoint exists, every
    `$.field` binding declared, every `reveals` target exists, and the view-shaped-endpoint rule —
    **every section's full binding set satisfiable by its ONE endpoint's declared Output** (a miss
    loops the endpoint plan through the existing `onFail` redesign: the endpoint grows a computed
    field rather than a page growing glue) — `{node, ref, message}` feedback with real options
    named;
  - `plan_view_components` + `implement_view_components` — the reusable card/row shapes as element
    compositions with typed props, one `writeProjectViewComponent` object literal each, upstream
    of `implement_views`;
  - `implement_views` — ONE `writeProjectView` object literal per page; no ok-list cross-check, no
    import rules, no TSX ✅/❌ blocks; retry loop reads the menu-shaped error and edits one field
    (target ≤ 60 lines of prompt);
  - `16-verify` (host-run) — runs `buildApp` on the generated wrappers PLUS the B4b functions:
    `validateAppViews` and `renderSmokeViews` against the seeded data, merging all three
    structured error lists; `17-fix` fans out per offending page/component/endpoint exactly as the
    appbuilder's gate-and-retry loop does today (an always-null binding routes the fix to the
    ENDPOINT, not the view); `18-finalize` adapted — resolves `ok` only when build + app-wide
    validation + render smoke are ALL clean.
- **New agent** `spec-builder`: authors specs only. Capability set deliberately excludes any TSX
  writer — `writeProjectPage`/`writeProjectComponent` NOT in this space's profile (not granted ⇒
  not injected AND absent from the DTS: freehand UI is a typecheck error, not a policed
  instruction). Charter: design within the vocabulary; if a surface cannot be expressed, say which
  part and why — never approximate with a wrong section.
- **THING routing (the one edit outside the new space):** one rule + one delegate example in
  `user-thing/agents/thing/instruct.md` — explicit "spec-based app" request →
  `delegate('system-viewbuilder', 'automator', 'build_live_project', …)`; everything else stays on
  `system-appbuilder` exactly as today.

**Not changing:** anything in `system-appbuilder/`; the api format; automations; the shared cli
build machinery except the additive Workstream-B pieces.

### Workstream E — Mobile native host

- **Spec-fetch REST route** on the pod: `GET /api/apps/:id/views` → `{ views, components,
  endpoints, shell }`. New `cli-api/rest` surface — documented per SYNC.
- **Native app screen**: `apps/mobile` `AppScreen` gains a native path — project has view specs →
  fetch + `<ViewRenderer client={…} spec={…}/>`; otherwise (appbuilder apps) the existing
  `AppView` WebView, unchanged. Team rail (`onOpenApp`) gets the same branch. The branch is total:
  **a viewbuilder app never touches a WebView on any page**.
- **Auth**: native calls endpoints with the pod token (`teamTokenGetter` pattern); no
  cookie/same-origin assumptions in the renderer's client.

### Workstream D — Visual gate

v1 in the **test harness**, not the pipeline: after a scenario build, screenshot every route
(desktop + 390×844) with the local puppeteer-core rig (chrome-devtools MCP screenshot hangs on
this machine) against the run's own server; the judge campaign scores them against the scenario's
user stories. v2 (after the loop stabilizes): an in-pipeline host node feeding `17-fix`, using the
in-cluster render service in prod pods.

### Workstream A — optional shared infra (off the critical path)

A2: unblock curated `@lmthing/ui` imports (`Markdown` + named icons) in the project-app typecheck
ambient (`sdk/org/libs/cli/src/app/build/typecheck.ts` + `save-typecheck.ts`) — additive DTS, no
resolution change. Serves only the appbuilder world now; do opportunistically or drop.

### Docs (SYNC.md — same change as the code, hard CI gate)

- `org/docs/format/project/pages/` — new `view-spec.md` (schema, bindings, defaults, the
  no-custom rule, the two-builder boundary) + README rewrite;
- `org/docs/runtime-globals/app-authoring.md` — `writeProjectView`/`writeProjectViewComponent`;
- `org/docs/app/views.md` — the renderer; `org/docs/cli-api/rest/` — the spec-fetch route;
- `org/docs/system-spaces/README.md` — the new space.

---

## Part 2 — Live testing with complex scenarios

Standing directive: **everything local, never prod.** The scenario runner gives per-run isolated
`lmthing serve` from TS source via tsx (no build step), own port/data dir, per-step snapshots +
`--resume`, budget-free Azure keys from `sdk/org/.env`.

**T0 — Desk check (before any code).** Hand-express the 9 remaining pages as v2 specs
(`kitchen/recipes` done): `homes/new` (wizard+prefill), `kitchen/index` (9-mutation dashboard),
`trips/[tripId]/expenses`, `blog/feed/[articleId]`, `health/medications/[id]`,
`homes/searches/[searchId]/inbox`, `blog/preferences`, plus two known-bespoke (`trips/timeline`,
`homes/compare`). The bespoke pair answers: (a) earn the 8th vocabulary slot, (b) reshape
acceptably into existing kinds (judge-checkable), or (c) named **out of scope** (legitimate — the
appbuilder exists for that class). Record per page: sections used, features missing from v1
schema, (a)/(b)/(c), flat-`item` vs component-tier need, which client-side transforms move to
which endpoint Output field or built-in, and **which page archetype the layout predictor would
pick vs what the shipped page actually looks like** (desk-checks the prediction heuristics against
real layouts, including each app's hand-written `_layout.tsx` nav vs the derived shell). **Go/no-go: ≥7/10 express cleanly with ≤2 new schema
features AND ≤1 of 10 lands in (c); else the vocabulary is not viable as a no-escape medium and
the design returns here before any engine code.**

**T1 — Unit + golden-app gates.** `cd sdk/org && pnpm test`; hand-migrate ONE golden app
(kitchen) to specs and prove `buildApp` green + every route serves.

**T2 — A/B baseline.** The frozen appbuilder's scenarios (`06`, `08`, `09`, `10`) re-run once to
snapshot judge scores, tokens, wall-clock. Comparison side: same briefs, distilled to direct
`delegate('system-viewbuilder', …)` drives, judged by the same invariants.

**T3 — Two NEW complex scenarios**, personas **explicitly asking for a spec-based app** (the
routing contract — also proves THING's rule fires, and doesn't in the old scenarios). Bar: ≥6
tables, ≥15 endpoints, ≥8 pages incl. dashboard, master-detail pair, prefill-assisted create,
background import (`async`), ≥2 automations — and **one deliberately vocabulary-hostile page
need**, because with no escape hatch the planner's boundary behavior is itself under test.
- `11-clinic` — physiotherapy practice; intake-email prefill; no-show automation; week-schedule
  need (the `timeline`/8th-slot probe).
- `12-rentals` — property management; background CSV-ish import; arrears dashboard; floor-plan ask
  (the expected honest "can't express this" case).

**T4 — Model matrix (the DeepSeek gate).** Every T2/T3 scenario runs with the M-slot pinned to
DeepSeek; once with the strong slot to separate design-caused from model-caused failures.
**Acceptance: DeepSeek-pinned runs go green.** A strong-slot-only pass is a design failure until
proven otherwise.

**T5 — Drive it with the automation** (standing directive): the lmauto judge campaign
(`sdk/org/scenarios/campaign/judge.md` flow; `automation/instances/app-builder` exists). Judge
every step on real evidence, fix ONE failure at a time at the right layer, prove each fix with a
`--resume` rerun, checkpoint, continue to fully green.

**Metrics per run** (evidence gotchas: read `full.json` lastText, not an empty `reply`; code-node
scalars are pod-internal): bricking rate (**0 by construction**); **vocabulary-gap rate**
(planner reports "cannot express", target <10%) and the judged **procrustean rate** (wrong-section
force-fits, target 0); forks/tokens/wall-clock vs the T2 baseline (expect ~10× fewer UI forks);
judge invariant scores; visual-gate pass (web + native); retry convergence (menu-errors working ⇒
≤1 retry per write); **layout-override rate** (how often the model sets `layout`/`shell`
explicitly — low = the predictions are right).

**T6 — Native rendering, first-class.** Three tiers, cheapest first: (1) metro graph gate +
per-section-kind render suites (`pnpm test:native`) — no emulator, proves resolution AND mounting;
(2) emulator live run via the local rig (`adb reverse`, `EXPO_PUBLIC_*`, Metro): the T3-built apps
open in the native path, **every page** renders natively — nothing to degrade; (3) native
screenshots (`adb exec-out screencap`) fed to the same vision judge as web — one set of user
stories, two targets.

---

## Part 3 — The improvement loop

A **failure-classification ratchet** — every red campaign step lands in exactly one bucket:

| bucket | symptom | fix layer | retroactive? |
|---|---|---|---|
| 1. vocabulary gap | planner reported "cannot express", or judge caught a procrustean fit | promote a feature/section kind into schema + renderer | **yes** — `BUILDER_VERSION` rebuilds every shipped app |
| 2. unhelpful rejection | model retries >1 on a writer error | make the error menu-shaped; unit test asserts the new text | n/a |
| 3. prompt gap | wrong sections / wrong granularity planned | edit the ONE node prompt; scenario rerun proves it | no |
| 4. renderer defect | visual gate fails on a correct spec | renderer fix + render test | **yes** |
| 5. representable model failure | invalid thing the schema allowed | tighten the schema so it is unrepresentable | yes |
| 6. genuine capability wall | correct spec/prompt, model still can't (typically a handler) | escalate that node's slot or split the node — last resort, recorded | no |

Rules: promotion on **second** occurrence (one is bespoke, two is a pattern) EXCEPT a blocking gap
promotes on first occurrence — with no escape hatch, promotion is the only relief valve; each
promotion must move the vocabulary-gap rate down on the next full campaign or be reverted (schema
minimalism is a feature for the weak model). The campaign is the regression suite (full T2+T3
rerun on the DeepSeek pin after every batch; lmauto's committed ledger is the record; `PROGRESS.md`
at repo root tracks workstreams). Docs move in the same change (`docs:check` gates). Ratchet
dashboard per round: vocabulary-gap ↓, procrustean = 0, DeepSeek pass ↑, tokens/app ↓,
retries/write → 1, bricking = 0. Two consecutive rounds with no bucket-1/2 findings ⇒ converged;
only then the separate promotion decision (default routing swap, catalog migration, store rebuild
— minding the destructive `projects/manifest.json` regeneration and stale-image gotchas). Rollout
stays opt-in throughout this plan.

### Risks, named

- **DSL worse than React** — killed cheaply by T0's go/no-go before any engine code.
- **Native is the concept, and native is where the traps are** (silent string-drops, no Yoga
  overflow scrolling) — renderer built native-first on the hardened `Prim.*` seam; metro suites
  from day one; T6 is a first-class gate.
- **No escape hatch ⇒ the vocabulary must be honest at its edges** — a too-small vocabulary blocks
  apps (relief: first-occurrence promotion on blockers); a force-fitting planner (relief: judged
  procrustean rate, 0 target; "say what you cannot express" is charter, tested by the
  vocabulary-hostile asks).
- **Two builders, copied nodes** — divergence accepted for v1; review-time checklist to mirror
  fixes; extraction only after the race verdict.
- **Schema-form ceiling** (array-of-objects, conditional fields) — `homes/new` is the T0 probe.
- **Renderer scope creep** — v1 hard-capped at 8 kinds; promotion rule is the only door in.
- **Strong-model regression** — T4's strong-slot runs watch for quality LOST vs the appbuilder
  baseline, not just weak-model gains.

## Execution strategy — parallel Opus fan-out (owner directive: work fast)

Implementation runs as **waves of parallel Opus subagents with disjoint path ownership** (the
judge-campaign coordination model: ownership by subsystem, not locks). The schema is the shared
contract every agent codes against, so it gets pinned first; after that the workstreams are
genuinely independent.

**Wave 0 — contract (parallel, fast):**
- Agent T0: the desk check — 10 pages as specs, archetype-prediction check, 8th-slot verdict,
  go/no-go evidence.
- Agent AUDIT: the element-catalog completeness audit — all 140 surveyed components mapped to
  element trees; gaps extend the catalog or are recorded as out of scope.
- Agent SCHEMA: draft `sdk/org/libs/cli/src/app/view-spec/schema.ts` (types + JSON Schema) from
  this plan's B1, with the 8th slot left as a placeholder.
Orchestrator reconciles the two (T0 findings amend the schema; go/no-go called here) and pins the
schema file. Nothing else starts until the schema is pinned.

**Wave 1 — build (4 Opus agents in parallel, disjoint paths):**
| agent | owns (paths) | delivers |
|---|---|---|
| CLI-ENGINE | `sdk/org/libs/cli/src/app/view-spec/`, `…/app/authoring/` (writers), `sdk/org/libs/core/src/typecheck/library-dts.ts` | B3 writers + B4b validation functions (`validate.ts`: spec / app-wide / render-smoke) + B5 validator/build tests |
| UI-RENDERER | `sdk/org/libs/ui/src/view/`, `sdk/org/libs/ui/metro/suites/` | B2 ViewRenderer (sections, elements, components, archetype + shell prediction, schema-form) + jsdom & metro render tests |
| SPACE | `sdk/org/libs/core/system-spaces/system-viewbuilder/`, the one THING instruct edit | C — copied nodes, new view nodes, spec-builder agent, routing rule |
| MOBILE | pod REST route (`sdk/org/libs/cli` server), `sdk/org/apps/mobile/` | E — `GET /api/apps/:id/views` + native AppScreen/team-rail path |
Each agent also writes ITS OWN `org/docs` pages in the same change (SYNC) and runs its own tests
green before reporting. `PROGRESS.md` at repo root tracks wave status.

**Wave 2 — integrate (sequential, orchestrator-driven):** T1 golden-app migration (kitchen) +
full `pnpm test` / `pnpm test:native` / `docs:check`; wire-up fixes.

**Wave 3 — prove:** T2 baseline snapshot + T3 scenarios authored (one agent each) → T4/T5 lmauto
campaign on the DeepSeek pin → D + T6 tier 3. Improvement-loop rounds follow the ratchet.

(A2 ambient unblock: optional, any wave, any idle agent.)

## Order of execution (dependency view)

1. Wave 0: T0 ∥ schema draft → schema pinned, go/no-go.
2. Wave 1: CLI-ENGINE ∥ UI-RENDERER ∥ SPACE ∥ MOBILE.
3. Wave 2: T1 golden app + full gates.
4. Wave 3: T2 baseline → T3 scenarios → T4/T5 campaign → D + T6; loop until converged; then the
   separate promotion decision.

## Verification (end-to-end)

The plan is its own verification ladder (Part 2): unit + build gates (`pnpm test`,
`pnpm test:native`), the golden-app migration, the A/B scenario campaign on the DeepSeek pin via
lmauto, the web + native visual gates, and the ratchet metrics — all local, never prod.
