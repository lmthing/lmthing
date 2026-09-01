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
| Format | `pi-terra` | `mcp/spaces/{space-probe,space-mini}/`, `src/format/{frontmatter,capabilities,load,knowledge,tasklist}.ts` | in progress |
| Server + discovery | `pi-terra-2` | `src/cli.ts`, `src/server/**`, `src/tools/discovery.ts` | in progress |
| Extraction + invocation | `pi-terra-3` | `src/schema/**`, `src/exec/**`, `src/tools/functions.ts` | in progress |
| Knowledge/tasklists/delegation/authoring | `pi-terra-4` | `src/format/{dag,write}.ts`, `src/tools/{knowledge,tasklists,delegation,authoring}.ts` | in progress |

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

## Open / to verify

- [ ] Integration: swap stubs, wire every tool group into the registry, full `vitest` green
- [ ] `npx @modelcontextprotocol/inspector node mcp/dist/cli.js --spaces-dir mcp/spaces`
- [ ] **The real gate** — add to the repo's `.mcp.json` and drive the whole surface from a live
      Claude Code session (expect one session restart for approval)
- [ ] **Does Claude Code honour `notifications/tools/list_changed`?** If not, per-agent dynamic
      tool lists are cosmetic and the fallback is one server process per agent via `--agent`.
      This fails SILENTLY, so it must be tested explicitly, not assumed.

## Gates

```sh
node sdk/org/node_modules/typescript/bin/tsc -p mcp/tsconfig.json --noEmit
cd mcp && npx vitest run
```

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
