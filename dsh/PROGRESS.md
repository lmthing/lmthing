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

  **Known pre-existing issue (not caused by this change, not fixed here):** a live *running*
  `dsh --profile <name> "<message>"` invocation fails with `MISSING_CREDENTIAL: llm-deepseek: no
  API key for provider route "deepseek-official"` even against the keyless-mock-configured
  `lmthing`/`tasklist-demo` profiles, whose patches correctly set `agent-default-model` to
  `lmthing-mock`. Reproduces identically on `tasklist-demo` (untouched by this change), so it's
  environmental, not a regression — likely something in the real `~/.dsh` global settings/
  credentials dir (dated 2026-08-22, predating this session) taking precedence over the profile's
  own patch. The `dsh/.dsh-home/profiles/lmthing` profile directory itself had also gone missing
  at some point (this session rebuilt it from the `tasklist-demo` profile's known-good template —
  `package.json`/`cordis.yml`/`pnpm-workspace.yaml` — since `.dsh-home` is gitignored, local-only
  state). Whoever picks up A1b/A2/A3 should resolve this credential-precedence issue first, since
  every later live-verification step in this track depends on a working keyless mock run.
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
- [ ] **A2 — `dsh-agent-presets` roster** for per-agent capability isolation (spike-gated).
- [ ] **A3 — fix the `lmthing-web` profile** to boot natively (no `--patch` workaround).
- [ ] **A4 — real component UI rendering** (`@lmthing/dsh-client-space-components`, reusing
      `@lmthing/ui`'s `render-descriptor.tsx` catalog).
- [x] **A5 — explicitly NOT in scope.** No system-space migration.
- [ ] **A6 — assemble the production `lmthing` web profile.**

## Part B — serve the dsh web UI as lmthing.chat

- [ ] B1 — pod runs dsh instead of `lmthing serve`.
- [ ] B2 — auth handshake shell (cookie JWT mint).
- [ ] B3 — Envoy routes/policies for lmthing.chat → pod.
- [ ] B4 — image/deploy wiring + canary, then cutover.

## Part C — remove the custom harness & dead web apps

- [ ] Decouple `@lmthing/ui` from `@lmthing/core` (keep ui in full).
- [ ] Delete `libs/core`, `libs/cli`, `apps/web`, `apps/app-shell`, `scenarios` (+ desktop/mobile
      decision).
- [ ] Docs + CI gate updates (`org/docs`, `build-images.yml`, `design-tokens.yml`).

## Operational notes

- A pre-existing, unrelated `git stash@{0}` (`WIP on main: e87ea91a fix(app): bump sdk/org —
  __APP_BASE__ for root-mount app router`, touching `PROGRESS.md` (root), `cloud/gateway/src/lib/
  {compute,db,tiers}.ts`, `devops/argocd/core/gateway.yaml`) exists in the parent repo — **do not
  pop or drop it**; it is someone else's in-progress work, unrelated to this migration. Confirmed
  present and untouched as of this note.
