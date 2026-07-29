# App builder v2 — `system-viewbuilder`

Started 2026-07-29. Plan: [`design/appbuilder-viewspec-plan.md`](./design/appbuilder-viewspec-plan.md).
(The previous occupant of this file — the team-surface mobile work, shipped — is archived at
[`design/teams-mobile-progress.md`](./design/teams-mobile-progress.md).)

**What this is:** a NEW sibling system space that builds apps as *view specs* — data, not TSX —
validated against endpoint contracts at save time and rendered by a shared `ViewRenderer`. Its
defining capability: those apps render **natively on the phone, with no WebView**. Two owner
constraints shape everything: `system-appbuilder` is **frozen** (not one line changes, routing to
the new builder is explicit opt-in), and the new builder has **no escape hatch** — every surface is
built from the element vocabulary or is honestly declared unbuildable.

## Waves

| Wave | Work | State |
|---|---|---|
| 0 | T0 desk check · element-catalog audit · schema draft | ✅ all three |
| 0 | **Gate:** reconcile evidence, pin the schema, call go/no-go | ✅ **GO** (one clause overridden — see below) · schema **PINNED** |
| 1 | CLI-ENGINE · UI-RENDERER · SPACE · MOBILE (parallel, disjoint paths) | ✅ all four |
| 2 | Integrate: golden app (kitchen) + full gates | ✅ **T1 PASSES**; both gates fixed and honest |
| 3 | Prove: A/B baseline, 2 new scenarios, DeepSeek gate, lmauto campaign, visual + native gates | 🔄 first live run + scenario authoring |

## Wave 0 — the contract

The schema is the one artifact all four Wave-1 agents code against, so nothing in Wave 1 started
until it was pinned.

| Agent | Deliverable | State |
|---|---|---|
| T0 | `design/viewspec-T0-deskcheck.md` — 10 shipped pages hand-expressed as specs; missing-feature list; 8th-section-kind verdict; archetype/shell prediction scorecard; **GO/NO-GO** | ✅ GO |
| AUDIT | `design/viewspec-element-audit.md` — every hand-built catalog component mapped to an element tree; ranked catalog amendments; interactivity gaps; out-of-scope list | ✅ |
| SCHEMA | `sdk/org/libs/cli/src/app/view-spec/{schema.ts,schema.test.ts,README.md}` — TS types + ajv JSON Schema, 8th kind pinned as `timeline` | ✅ |

### The gate call — GO, with one clause of the bar overridden

The plan's bar was: ≥7/10 pages express cleanly · ≤1 of 10 out of scope · ≤2 new schema features.
Measured: **9/10** ✅ · **1/10** ✅ · **4 features** ❌.

T0 reported the miss rather than shaving it, which is the right behaviour and the reason to trust
the rest of its numbers. I called **GO** anyway, and the reasoning is the record:

- The feature-count clause is a **proxy** for the question "is this the wrong medium?" — and the
  direct evidence answers no. **26 of 31** audited client-side transforms move cleanly to a computed
  endpoint Output field or a renderer built-in, usually producing a *better* result (a cross-query
  join becomes one server-side field). Only 3 can't move; only 1 costs a page.
- **None of the 4 additions is an escape hatch**, and none adds expression power — the spec language
  stays non-Turing-complete, which is the property the whole design rests on.
- There is **no 2-feature configuration that clears the ≥7 bar** (the best is 6–7/10), so honouring
  the clause literally would mean redesigning a vocabulary that the evidence says works.

What would have changed the call: an escape-hatch-shaped feature, a transform that couldn't move
server-side without client logic, or >1 page out of scope. None occurred.

### What Wave 0 actually found

**The two agents converged independently on the same #1 finding** — polling (`refetchInterval`
while a job is pending) from two different evidence bases, 20 files and 12 files. That's the
best-evidenced addition in the wave, and it's the difference between an app suite built on
background agents looking alive or looking dead.

**The catalog should be SMALLER than the plan proposed, not larger.** 47 of 153 real components
(31%) vanish before any mapping — 26 loading/empty/error states are renderer defaults, 1,435 LOC of
markdown bodies collapse into one element, 1,020 LOC of icon files into another. Five proposed
elements had ~zero measured demand (`chip`, `avatar`, `code`, `quote`, `map` — there are literally
zero avatar components). Net: **24 elements, strictly more capable than the 28 the plan's table actually listed.**

**The audit nearly failed by looking only at visuals.** Its own verdict: the visual survey was never
close to failing, but a visuals-only pass would have pinned a schema that renders every catalog app
beautifully *and lets a user change nothing about a row* — because `button {mutate}` carries no
argument, so a per-row "mark done" is inexpressible. Four such **section-contract** gaps (row-scoped
mutation arguments, sort + facet counts, polling, multi-select) landed in the pinned schema, where
they're cheap; promoting them later would have been the expensive kind.

**Two findings that removed work:** pagination demand is *literally zero* across 153 components and
84 pages (so `limit`-only is right), and no app does optimistic UI (so the plan's one accepted v1
loss costs nothing).

**The largest un-designed area is navigation, not rendering.** The derived shell reproduces **0 of
5** real apps: four of them hand-group 13–21 routes into 4–6 destinations, so a flat route→nav map
yields an unusable 21-item phone tab bar. And per-entity sub-nav (`TripTabs` = 15 tabs in 3 groups)
was entirely absent from the plan — without it, a spec app's per-trip pages cannot reach each other.
Both are now first-class schema concepts.

**8th section kind: `timeline`**, confirmed on evidence from two apps — and on a phone the timeline
form is *better* than the shipped 640px-wide scrolling grid it replaces.

### The pinned vocabulary

`sdk/org/libs/cli/src/app/view-spec/{schema.ts,schema.test.ts,README.md}` — 110 tests green,
`tsc --noEmit` clean. This is the contract all four Wave-1 agents code against.

- **8 section kinds, union FULL:** `list · detail · create · stats · markdown · chat · toolbar · timeline`. No `custom`, no 9th.
- **24 elements** (28 in the plan's table − 5 cut for ~zero measured demand + `field`). `field` is the
  inline-editable control; without it every generated app would have been read-only.
- **16 flat-item keys, closed.** The 11 text-ish ones take a string *or*
  `{ value, format?, currencyField?, tone?, toneMap?, maxLines? }` — one modifier rule instead of a
  paired `metaFormat`/`captionFormat` key explosion.
- **Bindings are strictly paths**: `$.` `$props.` `$data.<id>.` `$route.` `$result.` `$form.`
  `$client.timezone`. The regex rejects — with tests — `{{ x ? y : z }}`, `$.a + $.b`, `$.a ?? $.b`,
  `!$.endedAt`, `$.items.map(…)`, `format($.total)`, and embedded bindings inside string literals
  (`'/trips/$result.id'`) while keeping `'Cost: $5'` legal.
- **Navigation is `{ navigate, params }`**, never interpolation. Refusing
  `'/searches/$result.id/inbox'` is what keeps the non-Turing-complete guarantee real rather than
  decorative — interpolation is expression power wearing a different hat.
- Routes use the **authoring form** (`recipes/[id]`), matching `writeProjectPage`/`walkPages`.
- Defaults live in the **renderer**, not in ajv (`useDefaults: false`) — which is what makes them
  apply retroactively to shipped apps through `BUILDER_VERSION`.

**Cross-agent interface, pinned so three agents agree:**
`ViewRenderer({spec, components, shell, client})` and `createViewClient({baseUrl, getToken, endpoints})`,
exported from `@lmthing/ui/view`.

## Standing constraints

- **Everything local, never prod.** The scenario runner (per-run isolated `lmthing serve`, own port
  and data dir, snapshots + `--resume`) is the harness.
- **The DeepSeek pin is the acceptance bar**, not a stretch goal: a strong-slot-only pass is a
  design failure until proven otherwise.
- **Exit-status ground truth** — `buildApp`, `validateAppViews`, `renderSmokeViews`, the judge
  campaign. Never a model's self-assessment.
- Docs move in the same change as the code (`org/docs/**`, `pnpm docs:check` gates).

## Wave 1 — the arbitration that mattered: `views:write`

The two builders are separated by **what their agents can call**, not by what their prompts say.

CLI-ENGINE initially gated the three view writers on the existing `pages:write`, reasoning that a
spec-only space would simply leave the TSX writers out of its profile. That isn't possible here: a
capability profile is a list of capability **ids**, not of globals, and `pages:write` is one bare id
that injects `writeProjectPage`, `writeProjectComponent` *and* the view writers together
(`libs/core/src/typecheck/library-dts.ts:376` bundles all four DTS fragments under that key).

Under that gating, `system-viewbuilder` would have had to hold `pages:write` to write a single spec
— which hands it the TSX writers and their DTS. The zero-WebView guarantee would then have rested on
an *instruction* not to use them, which is precisely the kind of unenforced prose this design exists
to stop relying on. The runtime's actual rule is **not granted ⇒ not injected AND absent from the
DTS**, so freehand UI becomes a typecheck error the model sees and retries.

Resolution: a new `views:write` capability (registered by SPACE in `libs/core/src/spaces/`), gating
the three view writers **alone** — not OR'd with `pages:write`, since an OR would let one profile
hold both media and dissolve the separation again. Tested in both directions.

Consequence handled rather than papered over: `buildApp` is also bundled under `pages:write`, so the
viewbuilder's agents don't get it — `16-verify` is a HOST-run code node calling `buildProjectApp`,
and `18-finalize` runs no build of its own.

### SPACE — delivered

23 nodes. Verbatim copies of the data/behaviour half; `system-appbuilder` verified untouched
(`git status --porcelain` empty). Notable additions the plan didn't anticipate:

- **`15b-implement_shell`** — the shell had no home in the plan's node list, but T0 found 0/5 apps
  reproduce from a flat route list, and `validateAppViews` asks "is every route reachable from the
  nav?" — so the shell must be written *before* verify.
- **`05-plan_endpoints`** carries both mandatory Wave-0 amendments: one-section-one-endpoint, and
  "Toggles are ENDPOINTS" (the spec language has no `!`, so a save/pin/dismiss toggle must flip
  server-side or every toggle in every generated app is broken).
- **`17-fix` opens with** "NEVER 'fix' this by removing the binding from the page — that deletes the
  feature and the gate goes quiet." An always-null binding routes to the *handler*, never the view.
- **`18-finalize` carries `cannotExpress`** through to the user. With no escape hatch, an honest
  "I can't express this part" is a first-class output — it's what keeps the procrustean rate at zero.

THING routing is opt-in as specified: one added rule, one delegate example, the existing 6 call sites
untouched, and an explicit instruction not to switch builders on its own judgement.

Gates: `pnpm test libs/core/src/spaces` 331 passed · `tsc --noEmit -p libs/core` clean ·
`pnpm docs:check` 121 docs / 4894 citations all resolving.

### MOBILE — delivered, no native blocker

`GET /api/apps/:id/views` (`libs/cli/src/server/routes/app-views.ts`, 11 tests) returns
`{project, views, components, shell, endpoints}`. `endpoints` carries `{method, routePath,
inputSchema, outputSchema}` keyed by name — the two fields `window.__APP_ENDPOINTS__` supplies on
web, plus the schemas a `create` form derives from, because **native has no second source** for
them. Auth follows the neighbouring routes: none of its own on a personal (single-tenant) pod;
`team-guard` gates the team case before dispatch.

**The branch decision is the fetch itself.** `views.length > 0 ⇒ native`, everything else ⇒ WebView
— no project flag, because the thing that decides and the thing the native path needs are one
request. Every failure mode (404 from an older pod, offline, 500, junk body) resolves to WebView,
since none of those is *evidence* of a spec app and the appbuilder path is the default.

**Totality confirmed: no page kind was un-renderable natively, and once native there is no path back
to a WebView.** The appbuilder path is byte-for-byte the same element. One honest behaviour change:
a one-round-trip "Opening…" now precedes it, because you cannot branch without asking — and
rendering the WebView first then swapping would flash a WebView on a spec app, which is the one
thing this project forbids.

`pnpm test:native` PASS · route + mobile suites 22/22 · `docs:check` green. It also added
`apps/mobile/src/**/*.test.ts` to `vitest.config.ts` — that directory is outside the workspace and
had no suite running at all.

### Known reds carried into Wave 2

- `pnpm lint:tokens` — 3 `rgba()` in `libs/ui/src/elements/primitives/_native.tsx`, **pre-existing
  and unmodified at HEAD**. Hard CI gate, so Wave 2 must clear it.
- `libs/cli/src/server/session-manager.spaceref.test.ts` — fails only under full-suite parallel
  load, passes in isolation. Pre-existing flake, not caused by this work.
- A concurrent Claude Code session (the Play Store work) is committing to this repo in parallel;
  commit `d4d107b0` swept `org/docs/mobile/README.md` in. No viewbuilder agent has committed
  anything — all of this work is still uncommitted.

## Wave 2 — T1, the golden app: **PASS**

Kitchen (the hardest catalog app — 5 queries, 2 dependent, 9 mutations, cross-query joins)
hand-migrated to specs, no model in the loop, so every failure is the engine's.

- `buildApp` **green**: `ok=true built=true routes=13 errors=0`
- **13/13 routes serve and render** against a live seeded db: 0 page errors, 0 error-state
  sections, 0 empty forms.
- **Authored UI: 4,282 LOC of TSX → 1,599 LOC of specs (−63%).** What the model actually emits is
  **803 lines (−81%)**. The api layer grew +321 (+11%) — that is the moved computation, and it is
  the trade the design asks for. Net authored 7,162 → 4,800 (−33%).
- **45 of the app's 123 typecheck errors were in `pages/`+`components/` and are simply gone.** The
  13 generated wrappers contribute zero.
- **Archetype prediction: 0 overrides in 13 pages.** `layout` was never set once and every page came
  out right; section order was never reordered. **Shell: 1 override, forced and correct** — 13
  routes ≫ the derive limit of 5, exactly the case the schema predicts for 4/5 catalog apps.
- Verified live: `x-options` (a foreign key rendered a select that fetched its own options — without
  it, a UUID text box) and `$client.timezone`.
- `timeline` works as a **generic group-by**, not just dates — and the grouped result is better on a
  phone than the 640px horizontally-scrolling grid it replaces.

### The five wiring defects it found — every one broke EVERY route

Not one was visible to any existing harness. The web SPA, the mobile app and the renderer's own
jsdom suite each supply their own theme, client and params, so the single configuration nobody
exercised was **a project-app page bundle** — the only configuration a generated wrapper runs in.

| defect | symptom |
|---|---|
| wrapper mounted the renderer bare; every primitive calls `useTheme()` | 13/13 routes: "Missing theme" |
| client built at wrapper MODULE scope — ESM hoists page imports above `mountApp({manifest})`, so it captured `{}` | every section: "unknown endpoint" |
| wrapper never passed `route` | every detail page 404'd on load |
| endpoint manifest carried `{method, routePath}` only, and a `create` form has no other source on web | **every form in every app**: "Nothing to fill in" |
| the route param was injected into EVERY query; handler Inputs are `additionalProperties:false` | any page with a param 400'd throughout |

The last one is the instructive one: **`renderSmokeViews` already had the correct rule and the
runtime did not.** The gate and the renderer disagreed, and the gate was right.

### Both whole-app gates were broken — worse than useless, because they accuse innocent code

- **`validateAppViews`: 81 findings on a correct app, all 81 false.** Two causes, both proven:
  a contract reduction that isn't idempotent (the second pass recomputes `inputKeys` from an
  already-dropped `inputSchema`, so *every* `input` key everywhere reads as undeclared), and an
  Output-field walker that doesn't follow `$ref` — which is exactly what `export type Output =
  Recipe[]`, the commonest shape in the catalog, compiles to. Neutralise both and 81 → 1.
  Worse, the **writer path is immune to both**, so today the writer accepts specs the app-wide gate
  then rejects. That contradiction is the one thing this design must not have.
- **`renderSmokeViews`: mostly false negatives, and the headline metric inverts.** An error body
  counts as a row, so a page whose every endpoint 4xxs reports **100% coverage and not-empty** —
  perfect scores exactly when the app is most broken. Plus: rows taken from the first array-valued
  property (14 bindings checked against the wrong rows, each accusing an innocent handler), no
  dependent-`input` resolution, and a global param pool that hands a detail page another entity's id.

### Vocabulary gaps (bucket 1 — blocking ones promote on first occurrence)

- **Literal arguments are illegal** — `input` is `Record<string, Binding>`, so `{ meal: 'dinner' }`
  cannot be said. One endpoint called with three different constants (blog's TL;DR / ELI5 / Why-me
  buttons) is **inexpressible in the vocabulary at all**. Blocking; promoting now.
- `chat.agent` rejects kebab-case, which is this codebase's own agent-slug convention — a chat dock
  had to be dropped with no spec-side workaround.
- `groups[].routes` conflates nav destinations with highlight families, so drill-in routes become
  orphans and T1 had to invent two toolbar buttons purely to satisfy reachability.
- A flat `meta` can't carry a unit — "20" where the page said "20 min".

### Known pre-existing red, needs an owner decision

**`buildApp` is RED on the shipped catalog kitchen: 123 typecheck errors** (api 78, components 23,
pages 22), all the same idiom — a local `type Row = Record<string, unknown>` then `db.query(...) as
Ingredient[]`, which strict TS rejects. `runProjectAppCheck` short-circuits on typecheck, so **an
unmodified catalog template never reaches esbuild.** T1 cleared it mechanically to make gate 1
meaningful and introduced **0** new errors of its own; the real fix belongs to whoever owns the
catalog.

## Wave 2 — closed

Both gates were fixed and re-proved against the same 13-route app that exposed them:

| | before | after |
|---|---|---|
| `validateAppViews` | 81 findings, **all false** | **0** (orphan-route / dead-component / no-data checks still run) |
| smoke findings | 42 | **2, both true positives** |
| `recipes/[id]` coverage | 100% while every call 404'd | 100% on real 200s |
| `rendererMounted` | `false` — the tier never ran | **`true`**, 13/13 mount, 0 render errors |

Three things worth remembering from that round:

- **The smoke tier had never mounted anything.** `@lmthing/cli` pins React 18, `@lmthing/ui` peers ≥19, so `import('react-dom/server')` drove a 19 tree with 18's renderer. It reported itself as not-mounted rather than claiming success, which is the only reason this was discoverable — but the render-error tier had been dark the whole time. Worked around by resolving both from the renderer's own location; **the version split in `libs/cli/package.json` is the real fix and is still open.**
- **"Not measured" is now a third answer** beside 0% and 100%. That one distinction is what stopped a fully-broken page scoring perfectly.
- The four T1 vocabulary gaps all landed, three as widenings rather than new tokens. The blocking one — literal arguments — was applied at all **eleven** argument sites, not just the one that hurt.

Also cleared two reds that predate this work: `lint:tokens` (3 `rgba()` in the one function whose job is
to emit a literal colour, two of them the linter reading prose) and `authoring/tokens.test.ts` (`scrim`
arrived in `tokens.json` at 50% alpha and the derived-vs-hardcoded list never learned about it). Both
were on `main` before Wave 0. Only two parallel-load flakes remain, and both pass in isolation.

## Wave 3 — in flight

- **First live pipeline run.** The 23 tasklist nodes have never executed with a model in the loop;
  everything so far is unit-tested or hand-migrated. Small brief, local, driven straight at the space
  so THING's judgement isn't in the measurement. Failures get classified by the improvement-loop
  bucket, because that decides who fixes it and whether the fix is retroactive.
- **T3 scenario authoring** — `11-clinic` and `12-rentals`. Each persona asks for a spec-based app in
  their own words (routing is opt-in, so the ask has to be in the brief, and the old scenarios must
  keep *not* triggering it), and each carries one deliberately vocabulary-hostile page need: with no
  escape hatch, the planner's boundary behaviour is itself under test, and the right outcome is an
  honest "cannot express" rather than a forced fit.
