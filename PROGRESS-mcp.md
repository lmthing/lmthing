# `mcp/` — an MCP server for the space format

Plan: `~/.claude/plans/i-have-decided-to-vivid-pretzel.md`

**Goal.** A standalone stdio MCP server exposing the LMThing space format
(`agents/ functions/ knowledge/ tasklists/`) so any MCP client can load a space agent, use its
functions/knowledge/tasklists, and author new spaces. It replaces the retired QuickJS/TS-REPL
runtime for this purpose.

**Non-negotiables** (see the plan for the full list): zero `@lmthing/*` dependencies; no existing
space touched or used as a fixture; no project apps, pod, gateway or UI; space `components/`,
`events/`, `hooks/` and tasklist code nodes unsupported and surfaced as `Unsupported` rather than
silently dropped; spec is `org/docs/format/space/**`.

## The two seams (fixed before implementation; do not edit without telling every track)

| file | contract |
|---|---|
| `mcp/src/format/types.ts` | the data model — `Space`, `Agent`, `SpaceFn`, `Verdict`, `KnowledgeTree`, `TasklistDag`, `Extractor`, `SpaceFormatError` |
| `mcp/src/tools/ctx.ts` | `ToolDef` / `ServerCtx` / `ToolGroup` — a tool group returns plain defs and reads state through `ctx`; it never loads spaces or touches the MCP SDK |

`Agent.canDelegateTo`: `undefined` (key omitted) = **unrestricted**; `[]` = **none**. Opposite
meanings, easy to flip silently — every track has a test for it.

## Tracks

| track | agent | owns | status |
|---|---|---|---|
| Format | `pi-terra` | `mcp/spaces/{space-probe,space-mini}/`, `src/format/{frontmatter,capabilities,load,knowledge,tasklist}.ts` | landed |
| Server + discovery | `pi-terra-2` | `src/cli.ts`, `src/server/**`, `src/tools/discovery.ts` | landed |
| Extraction + invocation | `pi-terra-3` | `src/schema/**`, `src/exec/**`, `src/tools/functions.ts` | landed |
| Knowledge/tasklists/delegation/authoring | `pi-terra-4` | `src/format/{dag,write}.ts`, `src/tools/{knowledge,tasklists,delegation,authoring}.ts` | landed |

All four tracks landed and integrated. **37 tools**, 14 resources, 5 prompts (one per agent).
Gates: `tsc` clean, **27/27 tests** including a live end-to-end MCP gate.

## Done

- [x] `mcp/` scaffolded: `package.json` (deps: `@modelcontextprotocol/sdk` 1.29.0, `yaml`,
      `typescript`, `esbuild`, `vitest` — all from the root catalog), `tsconfig.json` (NodeNext,
      strict, `noUncheckedIndexedAccess`)
- [x] `mcp` added to the root `pnpm-workspace.yaml` — **only** to reach the catalog pins; it must
      never depend on an `@lmthing/*` package
- [x] Both seams written and typechecking
- [x] Typed throwing stubs for `format/load.ts`, `schema/derive.ts`, `exec/invoke.ts` so all four
      tracks compile against each other from minute one; integration is a stub swap, not a rewrite
- [x] Four `pi-terra` subagents spawned and prompted with self-contained briefs

## Four defects the unit tests could not see

All four gates were green — 20/20 tests, `tsc` clean — while the shipped server was broken.
They were found by `test/live.stdio.test.ts`: a real MCP client, over a real stdio transport,
against the server booted as a subprocess. The unit tests inject their own loader, so none of
this was reachable from them. This is the whole reason that gate now exists.

1. **Every space function had an EMPTY schema.** `SpaceServerContext.spaces()` called
   `loadSpaces(dir)` with no options, so no extractor was ever passed. `schema/derive.ts` was
   correct and unit-tested in isolation; it was simply never wired in. Every tool advertised
   `{type:'object', properties:{}}` and no call could work.
2. **The whole `functions` tool group was silently absent.** The registry held module *paths*
   with `.js` extensions behind a dynamic `import()` wrapped in a tolerant "group not available
   yet" branch — scaffolding for parallel tracks. Node's type stripping cannot resolve `.js` to
   `.ts`, so the import failed and the tolerant branch swallowed it. Now static imports: a
   missing group is a compile error.
3. **A failing space function returned MCP `isError: false`**, with the failure buried in an
   `{ok:false}` payload. `isError` is the signal a client actually reads, so a failure looked
   like a success to anything that did not parse the envelope.
4. **A seam flaw of mine:** `LoadOpts.extractor` was a single `Extractor`, but an extractor is
   space-scoped (its TS `Program` is rooted at one space's `functions/`). One instance across
   `loadSpaces` would resolve every space's types against the first space's program. Now
   `extractorFor?: (spaceDir) => Extractor`, called once per space.

## Confirmed working, live

- **`notifications/tools/list_changed` DOES work over a real MCP session** — the plan flagged
  this as an unknown that fails silently. `set_agent` from `probe` to `minimal` takes the tool
  list from 37 to 26 and back. The per-server-process fallback is not needed.
- Schema extraction is genuinely right: `string[]` carries `items`, `@param` text reaches the
  model, a defaulted parameter is optional, an **imported** interface resolves (`exact`), a
  function-typed parameter degrades to `degraded` **naming the parameter**, and an
  `export const schema` reports `explicit`.
- `undefined` returns become `null`; the diamond DAG yields `{inspect, expand}` after `start`.

## Open

- [ ] **Add to the repo's `.mcp.json` and drive it from a live Claude Code session** — the last
      acceptance step. Expect one session restart for approval.
- [ ] `export_claude_subagents` end-to-end: generate `.claude/agents/*.md` and confirm the
      generated subagent is actually reachable via the Agent tool.
- [ ] The authoring round trip driven by a model (`write_function` → new tool appears).

## Gates

```sh
node sdk/org/node_modules/typescript/bin/tsc -p mcp/tsconfig.json --noEmit
cd mcp && node --test "test/**/*.test.ts"
```

## Corrections made mid-flight

**The test runner is `node --test`, not vitest.** vitest is broken in this repo's **root**
workspace — `@voidzero-dev/vite-plus-core@0.1.24` is missing its native rolldown binding, so every
run dies with `Cannot find module '../rolldown-binding.linux-x64-gnu.node'`. Pre-existing; `mcp/`
was simply the first root-workspace package to run tests (it works in `sdk/org`, a separate
workspace, which is misleading). Node 24 strips TypeScript natively, so `node --test` on `.ts`
files needs no runner dependency at all — a better fit for a package whose whole point is
standing alone. vitest was dropped from `mcp/package.json`.

**The seam diverged from the spec in five places**, all found by reading
`org/docs/format/space/agents/frontmatter.md` and fixed in one pass while the tracks were still
running (a `tsc` run then located every affected call site — 2 of them):

| was | is | why |
|---|---|---|
| `Action.name` | `Action.id` (+ `label?`) | the spec's field is `id`; an invented name would have shipped |
| — | `Agent.defaultAction` / `model` / `triggers` | allow-listed keys that were simply missing |
| — | exported `AGENT_FRONTMATTER_ALLOWED_KEYS` | the allow-list is **fail-loud**: an unlisted key must abort the load, which is the whole reason it exists — a typo'd `capabilites:` would otherwise silently grant nothing |
| — | exported `CAPABILITY_IDS` (14) | an unknown grant id must fail the load |
| `canDelegateTo` 2-state | 4-state | `undefined` (omitted → unrestricted), `[]` (none), `['*']` (explicit wildcard), or an allowlist. Also `dependencies:` is a deprecated alias read only when `canDelegateTo` is absent |

Knowledge refs are also `domain/field` **or** `domain/field/option` — three parts are legal.

**`ToolGroup` idiom.** Three tracks independently hit the same compile error: an array of
differing object literals gets unioned, TypeScript adds `someKey?: undefined` to each member, and
that fails `Record<string, JsonSchema>`. Fix is to annotate each tool separately
(`const t: ToolDef = {...}`) rather than rely on inference over the array.

## Notes worth keeping

- `npx tsc` does **not** work in this repo (npx resolves a decoy package that prints "This is not
  the tsc command you are looking for"). Use `node sdk/org/node_modules/typescript/bin/tsc`.
- `esbuild` must be `^0.27` — the workspace's `vite` 8 peer-requires it, and pinning `^0.25`
  produces an unmet-peer warning across the whole workspace.
- Nothing may write to **stdout** except MCP frames; all logging goes to stderr. A stray
  `console.log` silently corrupts a stdio MCP session.
- Real-world conformance of both the parser and the extractor is **unmeasured** by design: the
  fixtures are authored alongside them, so they pass by construction. The 125 real function files
  under `store/*/functions/` are the obvious corpus for a later read-only survey.
