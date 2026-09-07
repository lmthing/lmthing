# dsh → production harness migration — progress

Tracks execution of the approved plan (`~/.claude/plans/i-want-to-fully-vivid-emerson.md`):
fully adopt dsh as the sole agent harness, retire `@lmthing/core`. Scope = agents/chat/orchestration
only; no system-space migration; `@lmthing/ui` is kept (decoupled from core) for future dsh
integration.

## Part A — harden & complete the dsh track (`dsh/`)

- [x] **A0 — pin dsh hard.**
  - Exact-pinned every `@deepseek-ai/*` peer/dev dependency across all 9 `dsh/packages/*` manifests
    (was `^0.1.1-rc.2` / `^4.0.1`, now exact `0.1.1-rc.2` / `4.0.1`). Root `dsh/package.json` was
    already exact-pinned.
  - Added `dsh/.npmrc` (`save-exact=true`) so future additions default to exact versions.
  - Verified `pnpm install --frozen-lockfile` is green after refreshing lockfile specifiers
    offline (`pnpm install --offline`, zero network resolution — proves no version actually moved,
    only the specifier string).
  - **Decision (user, 2026-09-07): defer full vendoring.** Rely on the committed `pnpm-lock.yaml` +
    exact pins + `--frozen-lockfile` as the safety net against version *drift*. Registry
    *availability* risk (npm yanking/unpublishing `0.1.1-rc.2`) is knowingly NOT covered —
    revisit (committed tarball mirror, ~41MB/198 packages, or a private registry) if/when a real
    outage happens.
  - **Found, not fixed** (belongs to A1): `packages/space-knowledge/test/resolve.test.js`'s
    "a real LMThing frontmattered option (user-thing playbooks)" test fails — the real
    `sdk/org/libs/core/system-spaces/user-thing` agent now declares capability `self:author`,
    which isn't in dsh's `CAPABILITY_IDS` allow-list (`packages/space-format/src/capabilities.js`).
    Pre-existing drift, confirmed unrelated to the pinning change. Fix when unifying the parsers.

- [~] **A1 — unify the three space-format parsers** into one `@lmthing/dsh-space-format`.
  Split into two independently-verified steps to contain blast radius:
  - [x] **A1a — DONE.** Rewrote `dsh/packages/space-format` as the canonical parser, in native
    TypeScript (no build step — same Node-24-native-type-stripping pattern `mcp/` already uses;
    `main: src/index.ts`, imports use explicit `.ts` specifiers + `allowImportingTsExtensions` —
    NOT the usual NodeNext `.js`-specifier convention, which does NOT auto-resolve to a sibling
    `.ts` file at runtime, confirmed by direct experiment). Export surface kept 100%
    backward-compatible for all 7 existing `@lmthing/dsh-space-*` consumers — zero required
    changes to any of them. New files: `types.ts`, `components.ts` (extracted, core's fuller
    loader restored — the legacy web/ink fallback dsh had dropped), `knowledge.ts` (extracted,
    merged field metadata + sorted enumeration + additive `optionTitles`), `dag.ts` (new:
    `validateDag`/`readyNodes`/`topoOrder`, ported from mcp, adapted to the map-keyed rich
    TaskNode via a duck-typed `DagNode` shape — no circular import). `capabilities.ts` fixes the
    real `self:author` bug. `frontmatter.ts` adopts mcp's two fail-loud improvements (unterminated
    fence / non-mapping frontmatter both throw) — but explicitly does NOT adopt mcp's "always trim
    the body" behavior for the no-frontmatter case: that's a separate, weaker-justified cosmetic
    difference a real consumer (`space-knowledge`) depends on NOT happening, caught by its own test
    suite and reverted to core/dsh's original untrimmed behavior.
    **Verified:** `pnpm typecheck` clean; `pnpm test` 23/23 in space-format itself (incl. new
    regression tests for `self:author`, the two new frontmatter throws, sorted knowledge
    enumeration, and the 6 new `dag.ts` tests); **full workspace `pnpm -r test` 193 checks, 0
    failures across all 9 packages** — proves zero consumer breakage. Live: profile assembly
    (`scripts/assemble-lmthing-profile.mjs`) successfully exercises the real `loadSpace`/
    `resolvePersonaText`/`resolveTasklistTools` pipeline against real fixtures. A live *running*
    `dsh` CLI smoke test is currently blocked by unrelated, pre-existing environment drift (see
    "Known pre-existing issue" below) — confirmed NOT caused by this change (reproduces identically
    on an untouched sibling profile, `tasklist-demo`).
  - [x] **A1b — DONE, scope corrected from the original plan wording.** The plan said "repoint
    `mcp/src/format/*` to import [the unified package]" — but `mcp/package.json`'s own description
    is explicit: *"Standalone: zero @lmthing/* dependencies."* Actually adding an import would
    violate that deliberate, real design property of a working piece of the system. Corrected
    interpretation: bring mcp's own standalone parser's BEHAVIOR into alignment with A1a's design
    decisions via native reimplementation (no new dependency), not code-sharing.
    - `mcp/src/format/types.ts`: `CAPABILITY_IDS` widened from the stale 14-id list (which
      `org/docs/format/space/agents/capabilities.md` itself still quotes — confirmed independently
      stale, a pre-existing doc/code drift bug, out of scope to fix here) to the real 20-id
      vocabulary.
    - `mcp/src/format/capabilities.ts`: `BARE_ONLY` widened to match (+6 desktop/team ids); ported
      the deeper per-capability config validation (unknown-key rejection, array-of-strings
      enforcement, non-empty-list requirements for `api:call`/`connections:use`) natively — closing
      the real fidelity gap from design decision #2, entirely within mcp's own zero-dependency code
      and its own `Capability[]` return shape / error style.
    - `mcp/src/format/frontmatter.ts`: **zero changes needed** — mcp's own version already IS the
      stricter behavior A1a adopted (mcp was the donor here, not the receiver).
    - **Deliberately left alone**: `load.ts`/`knowledge.ts`/`tasklist.ts`/`dag.ts`/`write.ts` — these
      implement mcp's own presentational shape (array-based `Agent`/`Space`, ref-addressing,
      `Problem[]`-accumulation across the WHOLE load rather than throw-on-first, `extractorFor`
      schema derivation) which is fundamentally and deliberately different from the runtime shape
      the dsh plugins need. A real, confirmed requirement (`format.load.test.ts`'s "fails loudly
      with every independent frontmatter problem") needs true multi-problem accumulation, which the
      base package's throw-immediately `loadSpace` doesn't do (and shouldn't gain, per A1a's own
      design decision #9 — that mode was deliberately deferred, and mcp's zero-dependency
      constraint means it wouldn't have been consumable here anyway). Rewriting mcp's whole
      orchestration to share code would be real risk for a component that isn't on the critical
      path to serving lmthing.chat.
    **Verified:** `pnpm typecheck` clean; full mcp test suite 54/54 (50 pre-existing + 4 new
    regression tests proving the deepened validation: full capability vocabulary recognized,
    unknown db config key rejected, non-array `tables` rejected, empty `api:call.allow` rejected —
    all previously silently accepted).

  **Pre-existing issue found AND FIXED (local-only, nothing to commit):** the live smoke test above
  failed with `MISSING_CREDENTIAL: llm-deepseek: no API key for provider route "deepseek-official"`
  even against the keyless-mock-configured `lmthing`/`tasklist-demo` profiles. Root cause: a
  gitignored, machine-local `dsh/.dsh-home/settings.yaml` (the `settings` plugin's persisted
  user-editable store — normally written by the web UI's Models page) had a stale
  `agent-default-model: {provider: deepseek-official, …}` entry left over from an earlier
  real-provider run, which takes priority OVER a profile's own `cordis.patch.yml` on every boot.
  Fixed by clearing that one stale key from the local file (not a repo change — `.dsh-home` is
  gitignored). Confirmed both documented Phase 2 behaviors now work end to end: `echo: hello`
  delegates to the echo specialist correctly, and `remember`/`recall` round-trip correctly. The
  `dsh/.dsh-home/profiles/lmthing` profile directory itself had also gone missing at some point;
  this session rebuilt it from the `tasklist-demo` profile's known-good template
  (`package.json`/`cordis.yml`/`pnpm-workspace.yaml`).
  Exhaustive line-level comparison done (agent frontmatter keys byte-identical everywhere;
  capability id lists, function/component/knowledge/tasklist loading, error philosophy, and
  frontmatter strictness all differ — see design decisions below). Design calls locked in:
  1. **Capability ids**: one flat list = core's 20 ids + dsh's missing `self:author` restored.
     Drop mcp's narrower 14-id subset (looks stale-doc-derived, not deliberate) — the parser
     describes what's on disk; consumers decide what they act on.
  2. **Capability config validation**: core/dsh's deeper validation wins (`parseDbConfig` et al.)
     — mcp's is a real fidelity gap (no unknown-key/array-type/non-empty/table-existence checks).
  3. **Function loading**: dsh's extension superset (`.ts/.tsx/.js/.mjs`) + core/dsh's laissez-faire
     loading (no mcp-style export-shape gating, which silently drops arrow-function exports).
     `schema`/`description`/`outputSchema` recognition stays OUT of the parser — that's correctly
     `space-functions`' runtime-import concern, not parse-time.
  4. **Components**: core's fuller loader wins (view/form + the legacy web/ink fallback dsh
     dropped). Adopt mcp's `Unsupported[]` reporting for what's deliberately unparsed
     (events/hooks) instead of silent invisibility.
  5. **Knowledge**: merge core/dsh's richer field metadata (`type`/`variableName`/`default`) +
     mcp's deterministic sorted enumeration + mcp's `label→title` surfacing.
  6. **Tasklists**: core/dsh's full `TaskNode` union wins (mcp's is a real subset — no code nodes,
     subgraphs, per-node capabilities/functions/canDelegateTo). Fold in mcp's `dag.ts` utilities
     (`validateDag`/`readyNodes`/`topoOrder`) and node-level `title` field as genuine additions.
  7. **`loadSpace` top-level**: core's `requireAgents` option + mcp's sorted enumeration
     (determinism, free win).
  8. **`dependentSpaces`/npm-install**: EXCLUDED from the unified parser — a side-effecting
     concern that doesn't belong in a pure parser; both mcp and dsh already independently chose
     not to do this; matches this migration's agents-only, no-side-effects scope.
  9. **Error-handling philosophy**: default throws immediately on first problem (core/dsh's
     behavior — what all 7 existing dsh plugins are written/tested against). Opt-in
     `collectProblems: true` accumulates into `Problem[]` instead, for mcp's `validate_space`
     tool UX. Explicit switch, not a silent blend.
  10. **Frontmatter strictness**: adopt mcp's stricter parsing (throw on unterminated `---` fence
      or non-mapping frontmatter) as the new default — only turns silent misparses into loud
      errors; matches the repo's existing fail-loud conventions elsewhere.
- [x] **A2 — `dsh-agent-presets` roster for per-agent capability isolation. DONE, live-verified.**
  The single highest-risk item in the whole plan (flagged for an early spike) — now fully working
  and confirmed via a real browser session, not just headless mock output.

  **Design, as built** (three new/changed packages):
  - **`@lmthing/dsh-preset-roster`** (new) — `generatePresetRoster(rosterDir, agents, registry)`
    writes one `<rosterDir>/<slug>/agent.cordis.yml` per agent, each mounting exactly
    `@lmthing/dsh-space { spaceDir, agentSlug, registry }` (registry is REQUIRED — see the real bug
    below). Written to `$DSH_HOME/.agent-presets/`, NOT a repo-tracked directory: the `dsh` CLI's
    own `composeProfile` (in `@deepseek-ai/dsh`'s `profile-boot-*.js`) unconditionally REPLACES an
    `agent-presets` row's `roots` config with just the shipped preset root, discarding any custom
    `roots` a patch declares — confirmed by reading the actual source. `$DSH_HOME/.agent-presets/`
    is `AgentPresets`'s own separate `includeUserRoot` mechanism (default `true`), the sanctioned
    way to add presets.
  - **`@lmthing/dsh-subagent-preset`** (new) — a `SubagentProvider` that composes each in-process
    child from a NAMED PRESET, not the parent's own composition. A deliberate, minimal fork of
    `@deepseek-ai/dsh-subagent-in-process-driver`'s `startInProcessRun`/`drivePublishedRun`/
    `readResult` (that package exports none of its private helpers). The one real change: `setup
    (childCtx)` calls `ctx.agentPresets.composeFrom(childCtx, parent.ctx)` (required first bind,
    per `dsh-agent-presets`' own README: "a subagent's child joins its parent's standing
    composition through composeFrom(), never through mount()" — composeFrom is the only bind that
    fits inside a synchronous creation window), then — AFTER `parent.ctx.agents.create({...})`
    resolves but BEFORE `drivePublishedRun` sends the child anything — `await
    ctx.agentPresets.recompose(handle.agent.ctx, targetPresetId)` re-links the child onto the
    TARGET's own preset instead. `recompose()`'s own doc is explicit this is valid "only while the
    agent has produced nothing" and "the caller owns that check" — publication is not production,
    so this window satisfies it. `handle.agent.ctx: Context` (confirmed from `@deepseek-ai/dsh-
    agent`'s own type declarations) is the scope-tagged context the presets service needs — the
    SAME fiber `setup(childCtx)` ran in. Also exports `registerPresetSubagentProviders(ctx,
    targets)` / a mountable plugin wrapper (`lmthing-subagent-preset-roster`) that registers one
    `lmthing-preset-<slug>` provider per target — MUST be mounted once, globally, at the profile
    level, not per-delegator: `ctx.subagents.registerProvider()` registers into a single
    process-global map and throws `DUPLICATE_PROVIDER` on a second registration under the same
    name, which would happen if two different delegators both listed the same target and each
    tried to register its provider itself.
  - **`@lmthing/dsh-space-delegate`** (rewritten) — no longer mounts the target's own
    `space-functions` into the delegator's scope, no `persona`/`toolFilter` narrowing. Each
    resolved target gets one `@deepseek-ai/dsh-tool-subagent` row bound to `provider: 'lmthing-
    preset-<slug>'` — that's it. The delegator's preset now holds ONLY its own tools + the
    `delegate_*` launchers, never the union.

  **A real, structural finding that reshaped the design mid-build:** `dsh-headless` (the bundle
  this whole track's `lmthing` profile used) has NO mechanism to preset-compose its OWN top-level
  agent — confirmed by grepping every installed `@deepseek-ai/dsh-*` package for `agentPresets`
  usage. That composition call (`composeAgent()`'s `await presets.mount(agentCtx, resolvedId)`)
  lives ONLY in `@deepseek-ai/dsh-host-apiproxy`, a `dsh-web-app`-only dependency (the web/API
  session-creation layer). Consequence: **true per-agent isolation is only achievable via the web
  bundle.** `scripts/assemble-lmthing-profile.mjs` now branches on bundle:
  - **Web bundle** (`lmthing-web`): patches `dsh-web-app`'s own pre-existing `agent-presets` row
    (`config: {default: 'thing'}` — a plain top-level `{id, config}` patch, NOT another `insert`;
    a second `insert` with the same id is a hard `duplicate loader entry id` error, confirmed
    live). `dsh-host-apiproxy` then auto-mounts the "thing" preset for every fresh top-level
    session — nothing else needs mounting at the top level.
  - **Headless bundle** (`lmthing`): keeps mounting `@lmthing/dsh-space` for THING directly at the
    top level (global scope, `mountPersona: false` + the global persona patch) exactly as before
    A2. Delegation still works (the child still recomposes correctly), but isolation is NOT
    complete there — THING's globally-scoped tools remain visible to every scope, including a
    recomposed child's, since the global layer is always inherited regardless of preset chain.
    Documented, permanent, and acceptable: headless is a dev/CI convenience, never the shipped
    surface (Part B serves the web bundle at lmthing.chat).

  **A real bug found and fixed mid-build:** the roster generator's config for `@lmthing/dsh-space`
  originally omitted `registry` entirely (`{spaceDir, agentSlug}` only). Since `space-delegate`
  reads `config.registry ?? {}`, every preset-mounted agent silently resolved ZERO delegation
  targets — `delegate_echo` never registered, no thrown error anywhere. Caught via live testing
  (not by any unit test, since the omission was structurally "valid", just empty) — fixed by
  threading the full registry through `generatePresetRoster`'s third parameter; regression test
  added (`preset-roster/test/index.test.js`) asserting every generated preset's config carries the
  complete registry, not an empty one.

  **Live verification (the actual proof, via a real browser session over chrome-devtools MCP
  against the `lmthing-web` profile — NOT headless mock output alone):**
  - THING's own tool schema (from the real session log, `request/header.tools`):
    `['delegate_echo', 'forget', 'recall', 'recallAll', 'remember']` — its own 4 functions + the
    delegate launcher.
  - The delegated echo child's own tool schema: **`['echoBack']` — exactly one tool, its own.**
    Confirmed by grepping the child's full system prompt text too: `remember`/`recall`/`forget`/
    `delegate_echo` appear NOWHERE in it. Zero leakage of the parent's tools or persona — the
    original union-of-tools fidelity gap this whole effort exists to fix is closed.
  - Both agents' own custom persona/charter text is present in their respective system prompts
    (confirmed by searching the FULL text, not just a truncated prefix — the first ~400 chars of
    every dsh-web-app session is stock harness boilerplate, which caused a false "persona is
    missing" alarm mid-investigation before the full text was checked).
  - `pnpm -r test` across the whole dsh workspace: still 100% green after all A2 changes (existing
    `space-delegate` tests updated for the new mount shape — no `functionsConfig`/`toolFilter`/
    `persona` fields any more, replaced by `providerName`/`lmthing-preset-<slug>`).

  **Operational notes hit along the way** (useful for whoever runs this again): a long-lived `dsh
  --profile web` server must be started via a real background job (`run_in_background`/`nohup` with
  a persistent shell), never a `timeout -s KILL <n>` wrapper — a bash timeout killed the server
  mid-browser-session more than once. Browser `localStorage`/`sessionStorage` can pin a POISONED
  session id across page reloads (one that's permanently `agent-busy`, "owned by subagent
  routing", from an earlier aborted attempt) — clearing storage AND reloading is not always enough
  if the id is also cached server-side against a shared `$DSH_HOME/sessions/`; deleting the shared
  `.dsh-home/sessions/` directory (pure local test litter, gitignored) resolved it. `dsh`'s own
  `pkill`/`pgrep -f` pattern matching can false-positive against the shell wrapper's OWN command
  line text — verify a real dsh process is gone with an exact-argv check, not just exit code.
- [x] **A3 — fix the `lmthing-web` profile to boot natively. DONE, live-verified.**
  Reproduced the exact documented failure first (`dsh --profile lmthing-web` + a real browser
  session → "This turn failed. Cannot read properties of undefined (reading 'prepare')" on the
  first tool call). Root cause confirmed: `.dsh-home/profiles/lmthing-web/package.json` pinned
  `@deepseek-ai/dsh-web-app` (and, once A2 needed it, `@deepseek-ai/dsh-agent-presets`) as
  **direct** dependencies — the stock `web` profile's own `package.json` lists only `@lmthing/*`
  link deps, letting `dsh-base`/`dsh-web-app` resolve "two-anchored" from the installation as
  bundles instead. The extra direct pins created a second module identity for the dsh-* host
  graph; a host-plane singleton then resolved `undefined` across that boundary on the first tool
  call — exactly matching the originally-hypothesized root cause from the plan.
  **Fix:** removed both extra direct deps from `lmthing-web`'s `package.json` (kept
  `@deepseek-ai/dsh-web-app` only in `dsh.profile.bundles`; `@deepseek-ai/dsh-agent-presets`
  resolves transitively via the hoisted linker without a direct pin), `pnpm install` inside the
  profile directory.
  **Live-verified** (real browser session, chrome-devtools MCP, booting `dsh --profile
  lmthing-web` directly — no `--patch` overlay): a `remember` tool call succeeds
  (`{"ok":true}`, previously the exact failure point), and a full cross-agent `delegate_echo`
  round-trip succeeds (`[echo specialist] A3 native profile works`, "1 subagent" shown).
  `scripts/run-web.sh` updated to boot `--profile lmthing-web` directly, dropping the
  stock-`web`-plus-`--patch` workaround entirely; `dsh/packages/README.md` updated (status section
  + roadmap now reflect A0-A3 done, and explicitly note the 12 remaining system spaces + the
  data/project-app half are OUT OF SCOPE per the user's direction, not gaps to fill).
  Likely provenance of the original bug, for anyone bootstrapping a new profile the same way:
  `dsh plugin --profile <name> add @deepseek-ai/dsh-web-app` (the natural way to add a bundle to a
  fresh profile) adds it as a direct dependency by default — the shipped stock profiles were
  hand-crafted to avoid this; a normal bootstrap doesn't know to remove it afterward.
- [x] **A4 — real component UI rendering. DONE, live-verified. Scope corrected from the plan.**
  The plan named `@lmthing/ui`'s `render-descriptor.tsx` catalog for reuse — investigation found
  this was based on a mistaken premise: that catalog renders a DIFFERENT LMThing feature (the
  `display()` global's generic `{type,props,children}` descriptor TREE, via `parseDescriptorPayload`
  imported from `@lmthing/core/ui` — the package being retired), not "look up a NAMED,
  space-authored `.tsx` FILE and render it", which is what `space-components`' `display` tool
  actually bridges. Confirmed independently: `space-components`' own doc comment already said "its
  own docs note space-authored `view` components are never actually rendered as real React in the
  current product either" — there was no existing renderer anywhere to reuse for this. Asked the
  user how to scope it; chose **server-side per-component bundling** (esbuild, real files, no
  client-side code-eval surface) over a client-side TSX-transpiler-plus-eval approach.

  **Design, as built:**
  - **`@lmthing/dsh-space-components`** (extended): a new `src/bundle.js#bundleComponent(name,
    source)` esbuild-bundles each declared component's real TSX source into a standalone browser
    ES module ONCE at `apply()` time (fail-soft — a bundling failure loses real rendering for that
    ONE component, never the `display` tool itself), base64-encoded. Threaded to the client via
    `output.presentationMeta(args, value)` — a real `dsh-tools` contract ("Pure replayable
    presentation projection... threaded verbatim from the tool/result event" into `ToolResult.meta`)
    — as `{component, kind, props, code}`.
  - **`@lmthing/dsh-client-space-components`** (new): the browser half. Host side is a genuine
    no-op plugin (`function apply() {}`) — exists only so the package is an "enabled Loader entry",
    confirmed by reading a REAL shipped example byte-for-byte
    (`@deepseek-ai/dsh-client-ui-skill/lib/index.js`, identical pattern). The browser half
    (`src/client.jsx`, built to `lib/client.js`) registers into `tool.call.toolview` keyed `display`
    (`@deepseek-ai/dsh-client-ui-tool`'s real extension point) and, on a settled call with a real
    `block.meta.code`, does the ONE dynamic `import('data:text/javascript;base64,'+code)` this
    whole feature exists to perform — a real ES module load through the browser's own loader,
    never `eval`/`new Function`. Wrapped in a real React error boundary (a broken space-authored
    component degrades to an inline message, never crashes the transcript). Falls back to a
    generic card (component name + JSON props) when there's no bundle yet or bundling failed.
  - **A real, load-bearing finding along the way**: the naive design (mark `react` `external` in
    the esbuild output, matching a normal bundler's convention) reproducibly failed LIVE with
    `Failed to resolve module specifier "react"`. Root cause: dsh's web client is not a plain
    browser module graph with an import map — its own module system
    (`@deepseek-ai/dsh-client-modules`, "Lazy CJS model") resolves every package via a custom
    `window.__ModuleLoader__` + synchronous `require()` inside a generated factory closure; there
    is no browser-native resolution for a bare `"react"` specifier anywhere on the page, so a real
    ES module `import()`ed from a `data:` URL (which carries no import map of its own) can never
    resolve it. **Fixed** with a custom esbuild plugin (`onResolve`/`onLoad`) that shims the bare
    `react` import to a virtual module reading `globalThis.__LMTHING_REACT__` — set by the client
    bundle to the EXACT SAME React instance it obtained via its own `require('react')` (confirmed
    by reading `@deepseek-ai/dsh-client-ui-skill`'s real built bundle byte-for-byte to learn the
    exact `window.__ModuleLoader__.load({id, factory: (require) => {...}})` envelope shape a
    `dsh.client` bundle must use — plain esbuild `format: 'cjs'` output wrapped in that envelope,
    since the real `@deepseek-ai/dsh-client-*` packages build with `tsdown`, not esbuild directly,
    but the OUTPUT SHAPE is what the Loader actually requires, not the tool that produced it).
    `jsx: 'transform'` (classic `.createElement(...)` output) used deliberately over the automatic
    runtime so only the single `react` specifier needs shimming.
  - Wired into the production `lmthing-web` profile (web bundle only — browser-only feature,
    mounted once, globally, not per-agent) via `scripts/assemble-lmthing-profile.mjs`.

  **Live verification (real browser session, chrome-devtools MCP, against a dedicated
  `components-demo-web` profile mounting `system-components-demo`'s `EchoCard` component):**
  - `display! Hello real render` → the transcript shows "Hello real render" / "live-verified" /
    "×2" / "demo" — `EchoCard.tsx`'s OWN JSX structure, not the generic fallback card (which would
    show raw JSON).
  - Confirmed via direct DOM inspection: a real `<p class="text-sm text-foreground">Hello real
    render</p>` inside a real `<div class="rounded-md border border-border bg-card p-3">` with 4
    children — byte-for-byte matching `EchoCard.tsx`'s actual JSX tree and classNames. Unstyled
    (Tailwind's CSS isn't loaded in the dsh shell) but structurally and behaviorally exact — a
    real, documented, separate follow-up (loading the design-token/Tailwind CSS into the client
    shell), not a rendering-mechanism gap.
  - Re-verified on the FULL production `lmthing-web` profile with A2/A3 all mounted together:
    boots cleanly, THING's own `echo:` delegation still works end to end
    (`delegate_echo` → `[echo specialist]`) — no conflict between the three parts.
  - `pnpm -r test`: 206 checks, 0 failures (space-components: 8 new bundler tests, incl. one
    proving the react-shim fix itself in Node by injecting a fake `globalThis.__LMTHING_REACT__`,
    and one proving the shim fails loud — not silently — when the global is unset).
- [x] **A5 — explicitly NOT in scope.** No system-space migration.
- [ ] **A6 — assemble the production `lmthing` web profile.**

## Part B — serve the dsh web UI as lmthing.chat

- [ ] B1 — pod runs dsh instead of `lmthing serve`.
- [ ] B2 — auth handshake shell (cookie JWT mint).
- [ ] B3 — Envoy routes/policies for lmthing.chat → pod.
- [ ] B4 — image/deploy wiring + canary, then cutover.

## Part C — remove the custom harness & dead web apps

- [x] **Decouple `@lmthing/ui` from `@lmthing/core` (keep ui in full). DONE, brought forward.**
  Delegated to a subagent (per user direction) while A4 was in progress. Every `@lmthing/core`/
  `@lmthing/core/ui` import in `libs/ui/src` (confined to the `chat/` subtree) was either vendored
  (type-only: `TraceEvent`/`TraceAttachment`/`NodeKind`/`NodeStatus`/`NodeDetail` → new
  `chat/store/trace-protocol.ts`) or ported natively, faithfully, in full (runtime values:
  `isRenderableType`/`parseDescriptorPayload` + the `CATALOG_BY_NAME` table they need → new
  `chat/components/{descriptor-protocol,component-catalog}.ts`; `isFormDescriptor`/`flattenForm`/
  `coerceValue`/`defaultFor`/`FieldSpec` → new `chat/components/forms/form-protocol.ts`). Nothing
  stubbed or dropped. `@lmthing/core` removed from `libs/ui/package.json`; every subtree
  (`chat/studio/computer/dashboard/team/view/platform`) left intact, per the explicit constraint.
  Verified: `pnpm --filter @lmthing/ui typecheck` clean (one pre-existing, unrelated vitest-type
  error confirmed via `git stash` to predate this change); `pnpm --filter @lmthing/ui test` 799/799
  passing; `pnpm lint:tokens` clean; the 7 product SPAs confirmed to only ever import
  `@lmthing/ui/{theme,elements/*,components/auth/*}`, never anything touched here.
  Committed in both `sdk/org` (`0aa2501a`) and the parent gitlink (`713df28b`), both pushed.
- [ ] Delete `libs/core`, `libs/cli`, `apps/web`, `apps/app-shell`, `scenarios` (+ desktop/mobile
      decision).
- [ ] Docs + CI gate updates (`org/docs`, `build-images.yml`, `design-tokens.yml`).

## Operational notes

- A pre-existing, unrelated `git stash@{0}` (`WIP on main: e87ea91a fix(app): bump sdk/org —
  __APP_BASE__ for root-mount app router`, touching `PROGRESS.md` (root), `cloud/gateway/src/lib/
  {compute,db,tiers}.ts`, `devops/argocd/core/gateway.yaml`) exists in the parent repo — **do not
  pop or drop it**; it is someone else's in-progress work, unrelated to this migration. Confirmed
  present and untouched as of this note.
