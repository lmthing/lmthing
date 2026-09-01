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

All four tracks landed and integrated. **14 resources, 5 prompts** (one per agent). Tools are now
DYNAMIC: **27 server-level tools** at boot (no agent selected) plus one tool per function the
active agent declares (`set_agent` grows the list live — 38 with `probe` active). Gates: `tsc`
clean, **33/33 tests** including a live end-to-end MCP gate.

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

## Registered in `.mcp.json`

```json
{ "mcpServers": { "space": { "command": "node",
  "args": ["mcp/bin/mcp-space.mjs", "--spaces-dir", "mcp/spaces", "--agent", "space-probe/probe"] } } }
```

Verified with that exact invocation and cwd: 37 tools, 5 prompts, 14 resources, a real
`joinTags` round trip, and relative `--spaces-dir` resolved from the repo root. The server finds
its own dependencies in `mcp/node_modules` because Node resolves from the file's location, not
the cwd — so the repo root needs no MCP dependency of its own.

**Two more defects found only by launching it the configured way:**

5. **The entry point ran nothing.** `cli.ts` self-started behind an
   `import.meta.url === argv[1]` guard. Once `bin/mcp-space.mjs` imported it, `argv[1]` was the
   launcher, the guard was false, `main()` never ran — and the client saw only
   `MCP error -32000: Connection closed`, with no error printed anywhere. `cli.ts` now exports
   `run()` and the launcher calls it. The live gate spawns **the launcher**, not `cli.ts`, so
   this class of bug cannot come back unseen.
6. **Node < 24 failed unreadably.** Pointing `.mcp.json` straight at a `.ts` file means an older
   Node dies with `ERR_UNKNOWN_FILE_EXTENSION ".ts"` before any of our code parses — which an
   MCP client shows only as "server failed to start". Hence `bin/mcp-space.mjs`: a `.mjs` parses
   on every Node, so its version check can actually report the real cause. The realistic way to
   hit this is a client launched from a desktop environment with a different PATH.

## Driven from a live Claude Code session — DONE

Session restarted, `space` approved, all 37 tools reachable as `mcp__space__*`. What that
confirmed, and the three further defects it found:

**Confirmed working in the real client**
- **Claude Code honours `notifications/tools/list_changed`.** `set_agent` to `minimal`
  (`functions: []`) removed all 11 space-function tools from the live tool list; switching back
  restored them. This had been flagged as an unknown that fails silently — it does not.
- Extraction, seen through a real client's tool schemas: union → `enum`, one- and two-level inline
  objects recursed, an **imported** interface resolved (`resolvedShape` → `{label, retries}`), a
  defaulted param optional, `opaqueShape` `degraded` naming `callback` in both the description and
  the verdict, `explicitSchema` → `explicit`. Every `@param` reached the model.
- `resolvedShape({label:'acceptance',retries:3})` → `"acceptance:3"` — typed nested object, real
  round trip.
- **The whole authoring round trip:** `create_space` → `write_function` → `write_agent` →
  `set_agent`, and the newly authored function appeared as a live MCP tool.
- `list_delegates` on the `open` agent (key OMITTED) returns every agent — unrestricted, and
  visibly different from `helper`'s `[]`.
- `export_claude_subagents` respected `probe`'s single-target allowlist and wrote one namespaced
  file carrying a `generated-by` marker.

**Defect 7 — the extractor was dropped again, at a SECOND call site.** `reload()` called
`this.loader(this.spacesDir)` with no options — the identical bug fixed earlier in `spaces()`.
Since every writer calls `ctx.reload()`, the **first authoring write silently collapsed every
schema in the server to `{properties:{}}`**, permanently, with no error. Found by writing a
function and then re-reading its schema; the live gate had never done that. Fixed by leaving
exactly **one** load call site — two forwarding sites where one forgets an argument is a failure
this codebase has now produced twice (see the `.claude` note in
[[reference-wiring-gaps-need-live-runs]] §5). New regression test covers write → reload → schema.

**Defect 8 — every writer returned the temp validation candidate, not the committed space.** So
`create_space` reported `dir: /tmp/lmthing-mcp-create-…` and `write_function` reported the space's
id as `"space"` (the temp dir's basename), with per-function `file` paths inside a directory
deleted moments later in the `finally`. The files on disk were correct; the *reported* identity was
a lie a model would act on. All five writers now re-parse the real location. `write_agent` also
disagreed with `write_function` about whether to extract, so its report showed `no extractor`;
both now extract.

**Defect 9 — every exported subagent was dead on arrival.** It emitted a YAML list of *space
function* names (`- greet`). Claude Code's `tools` needs ITS OWN tool names, and an MCP tool is
`mcp__<server>__greet`. The YAML-list syntax was fine (both a list and a comma-separated string are
accepted), but from **Claude Code 2.1.208 an unresolvable tool name is FATAL** — the subagent
refuses to launch rather than starting with fewer tools. This repo runs 2.1.252, so every generated
file could never have run. Confirmed against
[the subagents docs](https://code.claude.com/docs/en/sub-agents.md) rather than assumed.

Fixed: names are now `mcp__<serverName>__<fn>`. `<serverName>` is a **parameter** (default
`space`) because it is the key the *client* chose in its own `.mcp.json` — this server cannot know
its own alias. Two further judgements baked in: an agent declaring no functions now **omits**
`tools` entirely (inheriting) rather than emitting an empty list that would leave it with no tools
at all; and an `inheritTools` flag exists because listing only MCP tools means the delegate gets no
Read/Bash/Edit — narrow is the honest reading of `canDelegateTo` as a privilege boundary, but it is
not always what you want.

## Open

- [ ] Confirm a generated subagent is **reachable** via the Agent tool. Blocked on a restart, not
      on code: Claude Code does not hot-load `.claude/agents/` any more than it hot-loads
      `.mcp.json` — spawning `space-probe-helper` in the session that wrote it returns
      `Agent type not found`. A correctly-formatted `.claude/agents/space-probe-helper.md` is left
      in place (uncommitted) so the next session can finish the check; delete it if unwanted.
- [ ] Real-world conformance of the parser and extractor is still **unmeasured** — the 125 function
      files under `store/*/functions/` are the read-only corpus for that survey.
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

## Runtime-wide server (2026-09-01)

One server now serves the WHOLE runtime — every project under `.lmthing/`, not one pinned project
or agent. Requested: "all spaces under the .lmthing dir should be able to be loaded dynamically by
the harness … load spaces from any project and then agents".

**Layout.** Spaces live at `<root>/.lmthing/<project>/spaces/<spaceId>/`; the default project is
`default`. The fixtures moved accordingly (`mcp/spaces/` → `mcp/.lmthing/default/spaces/`) and
`.lmthing/` is deliberately **not** ignored at the repo root — the layout is real and the fixtures
are tracked. The CLI auto-creates `<runtimeDir>/<project>/spaces` so a first boot never fails.

**Refs gained a project part.** `Space.ref = "<project>/<id>"`, `Agent.ref =
"<project>/<space>/<slug>"`. Every ref-taking tool accepts the qualified form, and the bare form
(`<id>`, `<space>/<slug>`) when **unambiguous** — with two projects holding the same id the server
REFUSES, naming both candidates, rather than picking one invisibly. `list_projects` is now the
first tool a cold client calls; `describe_space` takes `ref` (the addressable identity), not `id`.

**Delegation is project-local by default (defect 10).** The format's native two-part
`canDelegateTo` entry means "<space>/<slug> in the source agent's OWN project"; only a three-part
ref crosses projects. This failed live — the allowlist resolved to nothing after refs grew a part
— while every parser test stayed green. `test/server.delegation.test.ts` now pins it with a
two-project fixture (same space id in both; a two-part entry must NOT match the foreign one).

**`.mcp.json` pins no agent** (requested): the server boots with no active agent — 27 static
tools, `get_active_agent` → `null` — and the client discovers and selects with
`list_projects`/`list_agents`/`set_agent` (verified live over stdio; the grown list arrives via
`tools/list_changed`). `--agent <ref>` remains a CLI option for a pinned deployment.

**Also resolved:** the generated subagent (`.claude/agents/space-probe-helper.md`, exported by
`export_claude_subagents` with MCP-qualified tools) is REACHABLE — the session restart picked it
up and Claude Code lists it with `Tools: mcp__space__greet`. The export round trip is closed.

**Counts after the refactor:** 33 tests (was 27), `tsc` clean. Open: real-world parser/extractor
conformance survey over `store/*/functions/` (unmeasured, by design).
