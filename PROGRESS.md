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
| 3 | **The A/B ladder** — same brief, both builders, three difficulty levels, on pixels | 🔄 L1 running |

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

### T3 scenarios — authored (`11-clinic`, `12-rentals`)

Both load clean (`--plan`: 17 and 16 steps, every fixture attached by some step). Counts each implies:
≥6 tables · ≥15 endpoints · 9 and 10 pages incl. dashboard, master-detail pair, prefill create and
background import · 2–3 automations.

**Neither persona says a keyword.** Each states a requirement about how the thing must run, with a
physical reason — one works one-handed between patients and had "a website squeezed into an app,
everything half a second behind"; the other is in stairwells with one bar of signal and stopped
opening the last thing because it timed out every time. The trigger phrasing appears **0 times in
scenarios 06–10**, which is the A/B contrast the plan needs.

**That immediately found a routing bug, before either scenario ran.** THING's rule listed only our
jargon ("spec-based", "natively-rendering", "without a WebView") *and* warned against switching
"because the user mentioned their phone" — so the one phrasing a real person uses was simultaneously
unlisted and pre-emptively suppressed. Opt-in routing was effectively opt-in for people who had read
our source. Fixed by naming the lay phrasings and stating the line that separates them from
over-triggering: **a requirement about HOW IT MUST RUN, not a mention of WHERE IT WILL BE USED.**
"I'll mostly use this on my phone" stays with the appbuilder; "it must be a phone app rather than a
wrapped website" is the ask; genuinely unclear gets one plain question, because switching on a guess
spends the user's choice for them.

The two vocabulary-hostile wants are deliberately different shapes. The clinic's room grid with
draggable blocks is hostile *because* `timeline` is adjacent and would look close enough — so the
honest outcome is **partial**: the week ships as a real timeline while the grid and the dragging are
named. The floor plan is the clean impossible case (no positional kind exists, and `map` was cut in
the Wave-0 audit for zero demand), and its temptation is nameable, so the expect fails a grid of
cards pretending to be one. Both wants are planted in the opening brief *and* asked again from inside
the running app — two different code paths.

Money invariants are arithmetic a judge can actually do: arrears total **£2,135**, and a planted
migration row charging £700 against a flat that never existed must not inflate it.

### `scenarios/13-plant-care` — whose it is

Not the scenario author's: its `scenario.yaml` predates that agent's first file by five minutes and it
contains a *completed run*, which that agent's brief forbade. It is the live-run lane's smoke harness
— a deliberately small 2-table brief driven straight at `system-viewbuilder/automator`, bypassing
THING, to measure the pipeline rather than routing. Recorded here so it stops reading as a phantom
test, since the campaign enumerates that directory.

### The harness gap the scenarios exposed

Three of the strongest new invariants were **unverifiable as written**, which is worth stating plainly
rather than discovering during a campaign:

- `compactStep`/`snapshot` record tables, manifest, delegates, errors and `lastText` — and **nothing
  about view specs**. Every assertion about a `timeline` section, a `prefill`, a `poll.while`, the
  generated-wrapper banner or an endpoint count needed the judge to read disk itself.
- `open_app` records build/check/page-status and says outright that "browser render is the judge's
  job", with no rig to do it. **This is exactly how the Wave-2 empty-form bug survived: "Nothing to
  fill in." passes `appCheck` cleanly.** A page can build, serve 200, and show the user nothing.
- No step verb reaches `GET /api/apps/:id/views`, so "the app opens in the native path" cannot be
  expressed in a scenario at all.

First two are now in flight (snapshot fields + the Playwright render rig with empty-render and
empty-form detection). The third is under assessment.

### Salvaged from the stopped Wave-3 agents

Four agents were stopped mid-flight; their partial work was verified and kept rather than discarded.

**The view writers were never wired into the hosts.** `writeProjectView` /
`writeProjectViewComponent` / `writeProjectViewShell` existed, held their own `views:write`
capability, and appeared in the DTS — and the pipeline still could not call one, because
`libs/cli/src/cli/bin.ts` and `libs/cli/src/server/session-manager.ts` each forward an **explicit
list** of authoring globals into the session and code-node context, and neither list had learned
about them. Every unit test passed, because unit tests construct the authoring object directly and
never travel through a host.

This is the same failure this project keeps meeting from a new angle: **the capability said yes, the
type said yes, and the wiring said nothing.** Only a run with a model in the loop asks all three at
once — which is precisely why the first live run was scheduled before the campaign, and it earned its
place on its first attempt.

**The shell's scroll container could not shrink.** `flexGrow` alone leaves a Yoga child sized to its
content, so a page grew past the viewport instead of scrolling inside it — the same
transcript-clipping bug this repo already fixed once in a different component. Now explicit
`flexShrink`/`flexBasis`/`minHeight: 0` down the chain, so the scroller is the thing that scrolls.

Verified: `pnpm typecheck` clean across 8 packages, 521 tests green in `libs/cli/src/server` +
`libs/ui/src/view`.

### `pnpm test:native` is environmentally blocked on this machine

`ENOSPC: System limit for number of file watchers reached`. **Not a code failure** — proved by
reverting the three salvaged files and re-running at `HEAD~1`, where it fails identically. Metro's
fallback watcher (no watchman installed) opens one `fs.watch` per directory, and there are ~19,655
directories under `sdk/org` alone; the React 19 + ink 7 install grew `node_modules` enough to cross
the 65,536 `fs.inotify.max_user_watches` limit. The harness config already carries an `UNWATCHED`
blocklist for this exact class of problem, but it cannot exclude `node_modules` — resolution needs it.

Unblock with either (needs sudo, so it is an owner action):

```bash
sudo sysctl -w fs.inotify.max_user_watches=524288   # add to /etc/sysctl.d/ to persist
# or install watchman, which uses ONE watch instead of thousands
```

The native gate was green earlier in this same session (after the React unification, before the
install grew the tree), so nothing about the renderer is known-broken — it is unverified, which is a
different and weaker statement.

### The first live run's two blocking findings — both fixed and committed

The Wave-3 live-run agent (before it was stopped) got a model driving `system-viewbuilder/automator`
for real, and found two bucket-1/bucket-2 bugs neither unit tests nor `docs:check` could ever have
caught, because both need ajv actually failing on a real mistake:

**Endpoint names were structurally unspellable.** `plan_endpoints` names endpoints in kebab-case
(`create-plant`), and the endpoint validator's own "did you mean" suggestions are spelled in
kebab-case too — but `ENDPOINT`, `INVALIDATES`, and `x-options`' `query` in `schema.ts` were still
pinned to `IDENT_PATTERN` (no hyphen). Every real endpoint name was rejected by the one field meant to
hold it: a genuine contradiction, not a gap, so per the plan's own rule it promotes on first
occurrence. Same shape as the Wave-2 `chat.agent` fix — swapped to `AGENT_NAME_PATTERN`. `REVEALS`
(section ids) stays strict: those are model-chosen identifiers, not codebase names. Fixed in
`libs/cli/src/app/view-spec/schema.ts` (sdk/org `c6697bc1`).

**The `Action` union was the one rejection class that never converged.** `Action` is
`oneOf: [{mutate}, {navigate}, {download}, {print}, {copy}]`, and `pruneUnionBranches` (the Wave-2
fix for exactly this shape) only handled "exactly one branch matched". Two more cases fell straight
through: a bogus key like `{ endpoint: 'doThing' }` that matches ZERO branches, and two verbs set at
once (`{ mutate, navigate }`) that match two. Both produced five-to-six raw ajv errors that directly
contradict each other — one line says `"mutate" is required`, its sibling says `"mutate" is not a
property here` — which is exactly what the live-run agent hit twice, on a component and a page. Both
cases are just as unambiguous as the one-match case (zero names the bogus key, two-or-more names the
extra ones), so `pruneUnionBranches` now collapses either to ONE synthetic `discriminantChoice`
finding. Fixed in `libs/cli/src/app/view-spec/messages.ts` (sdk/org `7486d17a`).

Also committed, salvaged from the same stopped agent within its own `system-viewbuilder/**`
ownership (sdk/org `336349d1`): `implement_views`/`implement_view_components` now `dependsOn`
`implement_endpoints` (copied verbatim from appbuilder, where it's correct — TSX resolves names at
typecheck — but wrong here, since the view writer validates against endpoints ON DISK at save time);
the automator no longer fabricates a success report when a tasklist envelope is lost mid-turn; and a
handful of near-miss authoring rules (`param` must be a binding, section ids are lowerCamelCase,
`keyvalue` pairs use `label` not `key`, no `endpoint` key on a button action).

`pnpm test libs/cli libs/core`: 2391/2392 green (one unrelated flaky `session-manager` test, passes
in isolation). The pipeline has still never been driven end-to-end by a model with both fixes in
place — that run is next.

### Unassessed: partial HARNESS/RATCHET work from the other three stopped agents

Two more stopped agents left substantial, unwired, uncommitted work — syntax-valid, well-documented,
but neither tested nor wired into anything that calls it yet:

- `scenarios/harness/lib/view-facts.mjs` (497 lines) — reads `pages/**/*.view.json` and the generated
  `.tsx` wrappers off disk to answer exactly the "harness gap" questions above (does a `timeline`
  section exist, did the wrapper banner render, is a form's field count zero). Not yet called from
  `scenarios/lib/evidence.mjs#snapshot`, which is the one place it needs to be for a scenario's
  `expect`s to see it.
- `scenarios/metrics/lib/{artifacts,scope,metrics,targets}.mjs` (~1,100 lines) — pure functions
  computing the plan's ratchet metrics (vocabulary-gap rate, retries/write, layout-override rate,
  …) from a run's on-disk artifacts, each metric declaring its own target and improvement direction
  from `design/appbuilder-viewspec-plan.md` Part 3. No CLI entry point ties the four modules
  together yet, and nothing has run it against a real run's artifacts (`13-plant-care/runs/*` exists
  and would be the first real input).

NATIVE-VERIFY (the fourth stopped agent) is blocked on the `ENOSPC` sysctl limit above regardless of
who resumes it.

### The pipeline built a clean app — and could not tell anyone

Run 4 of `13-plant-care` is the first end-to-end model-driven build that produced a working app, and
the first in which **all three gates actually executed**: `verify.built=true`,
`viewsValidated=true`, `renderSmoked=true`, `verify` running 4× across the fix loop. Ground truth:
all 4 pages on disk as `.view.json` specs plus `_shell.view.json`, only `AUTO-GENERATED` wrappers as
`.tsx`, `appCheck ok=true errorCount=0`, root page 200. Six endpoints landed as `plants-create`,
`plants-detail`, … — every one of those names unspellable before the kebab fix.

Then three separate mechanisms conspired to report it as broken, and the last one laundered that
back into a false success. All three are now fixed, and the shape of the answer matters more than
the individual bugs: **the save-time layer was never the weak point.** View specs are ajv- and
contract-validated by their writers; api handlers are rejected at save by typecheck (the live run
shows a `Record<string, unknown>` annotation and a misplaced `total_count` both refused). Every
prompt fix the live-run agent made is teaching the model to avoid a rejection that *already exists*.
The weak points were all at **node and agent boundaries**, where a model's word was taken for a fact.

**1. A gate could never see its own last repair** (`libs/core/src/tasklist/orchestrator.ts`, fixed in
`b9004363`). In the gate→repair topology — `onFail` on the repair node with a predicate reading the
gate it depends on (`fix.onFail = {goto: verify, when: "verify.ok == false"}`) — the repair runs
*after* the gate, so every recorded gate value predates the repair answering it. On budget
exhaustion `maybeResume` returned silently, handing `finalize` a value one full round stale. A run
needing exactly `maxAttempts` rounds could therefore **never** report success, however clean it
ended up. Proven: a standalone re-run of `validateAppViews` against the finished project returned
`{ok: true, errorCount: 0, checked: 4}`. Now the gate is re-measured once on exhaustion — the gate
only, not `resumeSet`, so no unbudgeted extra repair attempt. The frozen appbuilder shares this
engine and had the same latent bug; the fix improves it in the same direction.

**2. A relay could report success over its own pipeline's verdict**
(`libs/core/src/delegate/delegate.ts`, fixed in `d4904780`). `currentTaskResolve` overwrote
`capturedResult`, so the automator's `{ok: true, degraded: true, summary: "…app built…"}` silently
replaced `finalize`'s computed `ok: false` — while listing the two broken endpoints in the same
object. The instruct had already been patched **twice** in prose for this exact failure, which is
what made it structural. The envelope is now kept separately and a claimed success over a failed run
is put back to false with `okOverriddenBy`, keeping the agent's own summary and error list. One
subtlety worth recording: `envelope.ok` is *orchestration* success and was `true` here (the pipeline
ran to completion and concluded the app was broken) — the verdict is `envelope.data.ok`, and the
first cut of the check, reading only the outer one, would not have caught the bug it was written for.

**3. `fix.ok` was a demand for a claim nobody reads** (fixed in `75d5bd9e`). Three `fix` nodes
resolved a hardcoded `ok: true` after losing the binding (`Cannot find name 'w'`) they needed to
compute it. `17-fix.md` spent ten lines forbidding this, justified by "the gate downstream trusts
your `ok`" — which is false: `verify` cannot read `fix` at all (DAG cycle) and re-reads every
artifact off disk, `18-finalize.md` names `verify` as ground truth, and the ratchet's
retries-per-write derives from trace events plus artifacts. **So host-computing `fix.ok` was
commissioned and then deliberately not built** — there is no safety payoff behind a field nothing
consumes, and fix 1 guarantees `verify` now postdates the last repair, which is what made `fix.ok`
redundant all along. The prompt now tells the truth and asks for `ok: false` when a landing can't be
established.

Note how 1 and 2 masked each other: a false-negative gate, laundered into a true-ish positive. Two
bugs cancelling is the worst way to pass.

Verified: 1129/1129 in `libs/core`, 331/331 in `libs/core/src/spaces`, 86/86 in
`libs/core/src/tasklist`, and every new test confirmed to FAIL with its fix reverted.

### Run 7 — the ratchet moves, measured

Re-ran `13-plant-care` with all three fixes plus the live-run agent's prompt fixes. Every metric the
ratchet tracks moved the right way, and the numbers come from `scenarios/metrics/dashboard.mjs`
reading the run's own artifacts:

| | run 3 | run 4 | **run 7** |
|---|---|---|---|
| app state | **bricked** — 11 typecheck errors, root 404 | usable | **usable** |
| bricking rate | 1 · FAIL | 0 · PASS | **0 · PASS** |
| retries per write | 1.75 · FAIL | 1 · PASS | **0.60 · PASS** |
| `buildApp` findings | 11 · FAIL | 0 · PASS | **0 · PASS** |
| `validateAppViews` | null — never ran | 0 · PASS | **0 · PASS** |
| `renderSmokeViews` | null — never ran | 7 · FAIL | **1 · FAIL** |
| layout-override rate | — | — | **0 · PASS** |

The layout-override rate is the quiet win: **zero** — the archetype and shell predictors chose
correctly for all four pages and the model never had to override either. `viewFacts` is also now
present in real step evidence (the harness wiring earning its keep on its first live run): 4 specs,
`shellAuthored`, 7 endpoints, six section kinds including `timeline`, `wrapperBannersOk: true`,
`handAuthoredPages: []`, `routesWithoutSpec: []`, and a detected master-detail pair.

**The automator relayed the envelope verbatim** — `currentTask.resolve(result)`, with its diagnosis in
comments rather than in a rewritten `ok`. `okOverriddenBy` never appears in the run, so the prompt
fix held and the delegate backstop was not needed. Belt and braces, in the right order.

**The one remaining gate failure is the mechanism working, not failing.** `renderSmokeViews` reports
exactly one finding, correctly routed to the ENDPOINT rather than the view:

> `api/dashboard-stats/GET.ts` — *"sections[0].query: pages/index sections[0]: dashboard-stats
> answered 500, so this section renders its error state on every load. Fix the endpoint
> (smoke_endpoints reports the same call)."*

That is the "structurally-valid zeros" class the gate exists for — a spec whose every name resolves
and whose every binding is contract-valid, in front of an endpoint that 500s — named with its file,
its symptom, and a corroborating gate. 7 findings down to 1, and the survivor is a real handler bug
for the api-author lane, not a defect in the spec pipeline.

(Run 6 is a dud: a concurrent root-level `pnpm install` wiped a native binding mid-run. The dashboard
reports it `unknown` with a reason rather than as a pass — the null-vs-zero discipline paying off on
its first real chance to mislead.)

### Then we looked at it, and it was blank

Every metric above was green and the app was **completely unusable**. Opened in a real browser, every
page showed the top bar, the nav and the assistant strip, and **nothing else**.

Root cause: the shell's root Col sized to its CONTENT — 98px, exactly the top bar (56) + assistant
strip (42) — because the web mount point is a plain `<div>` (`display: block`) under `display:
contents` theme wrappers, and **a block box is not a flex container**, so `flexGrow: 1` had nothing
to grow inside. Every descendant divided zero: the scroller `clientHeight: 0` around `scrollHeight:
719`, and the first list row's buttons at `y: -107`, off-screen and unclickable. One property fixed
it (`height="100%"`, sdk/org `ce96a7bd`).

**Why this is the most important entry in this file.** It passed `buildApp`, `validateAppViews` AND
`renderSmokeViews` with zero findings; the ratchet scored it `app: usable`; and the a11y tree
cheerfully listed all four plants, because the DOM nodes existed — they were 0px tall. So:

> **HTTP 200 + green gates + a11y content is not evidence an app is visible. Only pixels are.**

`renderSmokeViews` cannot ever catch this: it mounts with `renderToStaticMarkup`, a *string* render
with no DOM, CSS or layout. Its `emptyRender` means "the spec produced no content for the DATA",
never "the user would see something". That limit is now written into the function itself
(`777b7abb`) rather than left for the next person to assume otherwise.

### Everything the visual pass then found

Fixing the blank page turned the app from "passes gates" into "actually inspectable", and four more
real defects fell out immediately — none of which any existing gate had reported:

| defect | where | fixed |
|---|---|---|
| shell root had no height ⇒ **every page blank** | `libs/ui/src/view/shell.tsx` | `ce96a7bd` |
| every **toned icon invisible on native** — `$foreground` reaches `react-native-svg`, which has no token layer, and draws nothing (25× in logcat) | `libs/ui/src/view/icons.tsx` | `269f1694` |
| a parameterised **subnav captured its static sibling** (`plants/[id]` matched `plants/new`) | `libs/ui/src/view/shell.tsx` | `269f1694` |
| the **router** did the same thing — `/plants/:id` swallowed `/plants/new`, so the create page was unreachable by any URL | `libs/cli/src/app/runtime/router.tsx` | `719b7ce2` |
| `create-plant`'s `inputSchema` is `Record<string, unknown>` with no `properties` ⇒ **"Nothing to fill in."** | api contract generation | **open** |

Three of those five are the *same confusion* — **a static segment must beat a parameter** — in three
different places. `apps/mobile/src/app-views.ts#resolveRoute` had the rule; the shell's prefix match
and the web router did not. Worth a look wherever else a route is matched.

### T6 — native rendering, verified

A viewbuilder app renders **natively on Android with zero WebView**. Evidence, not impression: 0
matches for `webview|XWalk|chromium` across 8 `uiautomator` dumps, and the complete class set in the
hierarchy is `android.view.{View,ViewGroup}` · `android.widget.{FrameLayout,LinearLayout,ScrollView,
TextView,ImageView}` · `com.horcrux.svg.*`. All four views render; scrolling is a real `ScrollView`;
tapping a row action round-tripped to the pod (`daysUntilNext -8 → 2`) and the list refetched in
place, so `invalidates` works natively too. Zero logcat errors.

Two things worth keeping: `height="100%"` does **not** break native (Yoga resolves the shell from
`flexBasis:0/flexGrow:1` and ignores it — measured, no fork needed); and **process-level evidence is
the wrong instrument** — `/proc/<pid>/maps` shows chromium libs mapped even on the dev-launcher home
screen with no bundle loaded, because the dev client loads the provider itself. The view hierarchy is
the claim.

### The render rig (Workstream D) — the gate that would have caught all of it

`scenarios/harness/lib/render-rig.mjs` (+ 60 tests), zero-dependency CDP over Node 24's native
`WebSocket`. Six checks per route × two viewports: `blankPage`, `collapsedScroller`,
`offscreenInteractive`, `horizontalOverflow`, `consoleErrors` (data, never a verdict), `emptyForm`.
The browser side collects a serialisable snapshot and computes NO verdicts; `analyzeSnapshot` is a
pure function over it, which is what makes the predicates unit-testable without a browser and stops a
browser-side throw becoming "no findings".

Two measurement choices came from measuring the real bug rather than guessing, and both matter:
content is **hit-tested on a grid inside the content region**, not over the whole viewport (the blank
page scores 5 text elements viewport-wide — the chrome painted perfectly — so a viewport measurement
would have PASSED it); and reachability counts an **ancestor** hit as unreachable (the first version
allowed `hit.contains(el)` and reported 0/12 unusable buttons on a page where none could be clicked).

Demonstrated to fail on the known-bad case, reproducing `ce96a7bd`'s own numbers: shell root 98px,
scroller `clientHeight 0 / scrollHeight 719`, **0 painted elements in-region vs 5 viewport-wide**,
8/12 interactive elements unusable, findings `empty-render` + `collapsed-scroller` +
`offscreen-interactive`. A rig not demonstrated to fail is worthless, and this one earned the
paranoia immediately — its first self-test observed `document.documentElement` inside
`addScriptToEvaluateOnNewDocument`, where it is **null**, so nothing was ever broken; it reported
`applied: 0, pass: false` rather than claiming proof.

**Not yet wired**: nothing calls `renderCheck`. Hooking it into `scenarios/lib/evidence.mjs#snapshot`
or an `open_app` step verb is the remaining step (~7s for 4 routes × 2 viewports, findings already
`ViewError`-shaped for the merge).

## The A/B ladder — deciding the migration on evidence

Owner question (2026-07-31): *before migrating app building to `system-viewbuilder`, prove it
produces apps as good as `system-appbuilder`'s — and that they fully work.* Everything below is
local, on the DeepSeek pin, driven **directly at both automators** via `space_session` so THING's
routing judgement is not part of the measurement.

### First, the gate that made the question answerable

`renderCheck` had existed since Workstream D with 60 tests and a demonstrated failure on the
known-bad case, and **nothing called it**. `open_app` recorded build + typecheck + a 200 and said
outright that "browser render is the judge's job", with no rig to do it. Wired in behind
`open_app: {render: true}` (`aa24b5fc`), plus a new **interaction probe** behind `interact: true`
that clicks one control per route with a real `Input.dispatchMouseEvent` — not `element.click()`,
which would happily succeed on a button under an overlay — and asks whether the app did anything at
all: a request, a navigation, or a re-render.

Two design points worth keeping. The gate is **builder-neutral**: routes come from `appBuild`'s own
route table and carry their authored `file`, so a finding names `pages/x.tsx` for a TSX app and
`pages/x.view.json` for a spec app — which is what lets one instrument score both sides. And route
parameters are resolved **per-collection, never from a global pool**, because that pool is the
shipped bug that smoked `recipes/[id]` with an INGREDIENT id and then blamed the page.

**It earned its place immediately.** Replayed against `13-plant-care` run 7 — the run every existing
gate called clean and the ratchet scored `app: usable` — it returned five real findings:

| finding | what the user would hit |
|---|---|
| `empty-form` on `plants/new` (both viewports) | **the app cannot add a plant**; the page says "Nothing to fill in." |
| `action-failed` — Save → 400 | the consequence of the above |
| `action-failed` — dashboard-stats 500 | the front page shows "Something went wrong" |
| **`dead-control`** — "Details" does nothing at all | never reported by ANY gate before |

The first three confirm known-open items from a second, independent direction; the `dead-control` was
new. Screenshots confirmed all of it in pixels.

### The ladder

`viewbuilder.yaml` is the source of truth in each pair and `appbuilder.yaml` is **generated** by
`scenarios/harness/ab-pair.mjs`, which rewrites the id, the title and the `space_session` target and
nothing else — asserted by a test, because two hand-kept copies of a 40-line brief do not stay
identical and the drift would be invisible (both halves still parse, still run, still produce numbers
that look like an A/B). Neither builder's nodes declare a `model:`, so both run the default alias `M`.

| level | scenario | shape |
|---|---|---|
| L1 | `30-bike-workshop` | ~4 tables, 6 pages — one computed figure, one toggle, one follow-up edit |
| L2 | `31-food-coop` | the plan's own T3 bar: ~6 tables, 9 pages, prefill, background import, 2 automations, planted arithmetic (£47.30) |
| L3 | `32-festival` | ~8 tables, 12 pages, per-entity sub-nav, a timeline, a chat dock, cross-entity clash detection |

**L3 carries a deliberately vocabulary-hostile ask** — soundcheck playback with a scrubbable
waveform. The 24-element vocabulary has no media element and no canvas, and there is no escape hatch,
so the correct viewbuilder outcome is an honest "cannot express this part" while the appbuilder can
author it freehand. That asymmetry is the experiment, not a flaw in it: it prices the ceiling in the
one place the ceiling actually binds.

Scored by `scenarios/metrics/ab-report.mjs` — builder-neutral by construction, three sections: does
it work (build/typecheck, then blank pages, collapsed scrollers, unreachable controls, empty forms,
dead controls), is it as capable (tables, rows, endpoints, routes, hooks), what did it cost (authored
UI lines excluding generated wrappers, tokens, wall clock).

### Standing hazard, mitigated not ignored

Two live scenario runs at once saturate the Azure endpoint; every turn then fails with connect
timeouts and the harness marks the steps VOID, so the run tests nothing. The owner asked for L1 in
parallel, so each half runs with `SCENARIO_MAX_SESSIONS=12` (half the default) and the watch greps
for the outage signature every 10s to abort early rather than burn two hours. If it saturates
anyway, the fallback is staggered runs.

---

# 2026-09-01 — zero-error app builds (overnight optimize/live-test cycles)

Continues the appbuilder work above. Goal: a fresh `build_live_project` finishes with **zero
`[error]` lines** and never invokes `repair_live_project`.

**Goal:** a fresh `build_live_project` finishes with **zero `[error]` lines** and never invokes
`repair_live_project`. Then the follow-on loop (features, fixes, data entry, space agents) works.

## Scoreboard

Runs come from `sdk/org/scenarios/parallel-build.mjs` (fresh project + new session per run, one
provider slot per concurrent lane, preflighted). These are **stochastic** — judge a change against
prior runs, never against a single result.

| Batch | Date | Idea | Model | `[error]` lines | repair? | PASS |
|---|---|---|---|---|---|---|
| 1 | 09-01 01:0x | recipe box | `azure:DeepSeek-V4-Flash-0731` | **36** | yes | no |
| 1 | 09-01 01:0x | gym workout log | `azure:DeepSeek-V4-Pro` | **133** | yes | no |
| 2 | 09-01 02:5x | gym workout log | `azure:DeepSeek-V4-Pro` | **69** | yes | no |
| 2 | 09-01 03:0x | recipe box | `azure:DeepSeek-V4-Flash-0731` | **92** | yes | no |
| 3 | 09-01 03:5x | recipe box | `azure:DeepSeek-V4-Flash-0731` | **66** | yes | no |
| 3 | 09-01 03:5x | gym workout log | `azure:DeepSeek-V4-Pro` | **52** | yes | no |

> **Batch 1 is NOT comparable to later batches.** It ran before the typed view writers, when malformed
> specs were accepted silently and failed later at ajv or not at all. Its lower count means fewer
> *detected* failures, not a better app — the skeleton problem showing up in the metric itself. Compare
> batch 2 onward.
>
> Trend on comparable batches: Flash 92 -> 66, Pro 69 -> 52.

Note: run 2's higher count is not simply "Pro is worse" — it produced 19k log lines vs 7k, i.e. it
attempted considerably more work, so it had more opportunities to fail. Compare like-for-like ideas
before drawing a conclusion about models.

### Batch 1 → 2, like-for-like (gym log on Pro): 133 → 69

The total halving matters less than WHICH classes went away. These vanished from the census entirely,
each one traceable to a specific fix:

| Gone | was | fix |
|---|---|---|
| `Argument of type '{ route; sections: unknown[] }' …` + the whole vague `not assignable to ViewSpec` tail | 5 + ~25 singletons | plan-artifact-is-not-the-spec, plus inline-literal authoring (freshness) |
| `Property 'raw' does not exist` | 4 | the note moved INSIDE the injected DTS |
| `Variable 'w' is used before being assigned` | 3 | named the message next to the one-statement rule |
| `a "create"/"update" needs a "set" map` | 2 + 2 | a copyable dual-branch example + the rejection now names the table's columns |

One class went the WRONG way: `a handler imports from "../../types/contract"` rose 2 → 4 and is now the
top error. The knowledge layer was updated but the api-author's own EXAMPLE was not — and the example is
what gets copied. Routed as task 14.

## Fixed and pushed

| Class | Root cause | Where |
|---|---|---|
| prose evaluated as code | `looksLikeProse` bailed on any code punctuation, so prose *about* code (`` `views/books/[id]` ``) was executed | `eval/turn-loop.ts` |
| `Cannot find name 'f'/'pg'/'ep'` | fork/delegate lost accumulated context across the forced-resolve nudge; `session.ts` already did it right | `fork/fork.ts`, `delegate/delegate.ts` |
| `Parameter 's' implicitly has an 'any' type` | `noImplicitAny` at the dynamic agent-value boundary | `typecheck/tsc.ts` |
| view specs failing only at ajv | the four writers took `spec: unknown`; now generated `ViewSpec` types + `defineViewSpec` + a drift gate | `typecheck/library-dts.ts` |
| `Property 'raw' does not exist` | `.raw` exists on the ENGINEER's scratch `readFile`; the note was first written OUTSIDE the injected DTS string where the model could never see it | `typecheck/library-dts.ts` |
| `Unexpected end of JSON input` | fix templates called `JSON.parse(cur.content)` where `readProjectFile` returns `content: ''` for a missing file | `17-fix.md`, `02-fix_broken.md` |
| read-only apps | no write floor, `prefill` taught nowhere, no gate; 4/4 apps could not edit or delete | `05-plan_endpoints.md`, `07-plan_views.md`, `08-validate_contract.ts` |
| no delete path | `QueryKind` had no `delete`; authoring surface was write-only | `ir/query.ts`, `authoring/globals.ts` |
| follow-on routed to build | `grow-project.md` / `add_area` delegated `build_live_project` for changes to an app that exists | user-thing playbooks |
| no bulk data entry | seeding was deferred to a job implemented nowhere | `iterate_live_project/06-enter_data.md` |

## Open — dispatched

| Class | Count | Agent |
|---|---|---|
| plan object passed into `writeProjectView` (`purpose`/`endpoints`/`components` are PLAN fields) | 8+ | pi-glm |
| `create`/`update` needs a `set` map | 4 | pi-terra |
| invented relative import `../../types/contract`; `used before being assigned`; `unknown` values; reader result passed where a string is wanted | 9 | pi-deepseek-flash |

## Operating rules learned the hard way

- **Never exceed 6 subagents** — 8 restarted the whole herdr session and lost 5 in-flight tasks.
- **Live builds and Azure-backed agents share ONE Azure resource.** Running both starves the agents
  (`Request timed out`). Curl the endpoint first to rule out an outage/bad key, then read the pane's
  context gauge before blaming the provider.
- **A CLI flag parsing is not proof its value resolves.** The harness's first run reported
  `FAIL / 0 [error] lines` from an invalid model spec — a harness bug wearing the costume of a product
  result. It now preflights every slot with a real completion and reports VOID distinctly.
- **Poll the report artifact on disk**; `agent_status` and `--wait` lie.
- Verify every agent test claim by re-running it.

