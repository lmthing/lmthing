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
`default`. The fixtures moved accordingly (`mcp/spaces/` → `mcp/.lmthing/default/spaces/`, then —
when `.mcp.json` was repointed at `--root .` — to the REPO ROOT `.lmthing/default/spaces/`, the
same layout a real user gets). `.lmthing/` is deliberately **not** ignored at the repo root — the
layout is real and the fixtures are tracked — but `.runs/` beneath it IS (runtime data). The CLI
auto-creates `<runtimeDir>/<project>/spaces` so a first boot never fails.

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

### First live tasklist walk (2026-09-01, from this session)

Drove `run_probe` (the diamond) end to end through the in-session server: `next([])` → `start`
→ gathered 3 samples by really calling the space's functions (`addNumbers`/`greet`/`joinTags`)
→ `next(['start'])` correctly forked to `inspect`+`expand` → executed both (`condition`
evaluated client-side: samples non-null; `forEach` ran 3 iterations) → `next` correctly withheld
`report` until BOTH branches were in the completed set → joined, produced the report, exhausted
to `[]`. Bad slug errors name the available lists.

**Friction observed (design, not bugs):** the client holds ALL run state — completed ids and node
outputs live in the caller's context, there is no `mark_complete`, so a reconnecting client
re-derives everything from its own transcript; `index.md`'s `input:` schema is inert (binding is
pure client convention, and the fixture's `target` is referenced by no body); `condition`/
`forEach` are free-text interpreted by the model, not an expression language — fine when the MCP
client is an agent, a soft spot if a deterministic client ever walks a DAG.

### Run state is now programmatic (2026-09-01, fixes the first friction above)

`start_task` / `complete_task` (requested names) walk a tasklist with the state held ON DISK, and
a drifting harness is **nudged**:

- **State** is one JSON file per (agent, tasklist) at
  `<root>/.lmthing/<project>/.runs/<space>/<agent>/<slug>.json` — runtime data OUTSIDE `spaces/`
  (the parser never sees it), gitignored, atomic via tmp+rename, keyed per agent so two agents
  sharing a space never clobber each other. Every call re-reads it: a reconnecting harness asks
  the server where it is instead of re-deriving from its own transcript.
- **Nudges on drift**: completing a never-started node and starting a blocked node are
  `isError` refusals naming what IS ready; restarting a completed node returns its recorded
  output plus a `reset: true` hint; a completion missing fields the node declares in `output:`
  is accepted but nudged. State edited out from under the DAG (a tasklist changed mid-run) is
  reconciled and reported as `adjustedFromRun`, never silently kept; corrupt state is loud.
- **The harness carries nothing**: `start_task` hands back the node body plus dependencies'
  recorded outputs; `complete_task` returns the newly-ready nodes each already briefed with
  `inputs`. `next_tasklist_nodes` derives completion from the run when `completed` is omitted;
  pass the list and it stays a pure topology query.
- **Tasklists belong to agents** (user correction): every tasklist tool addresses the ACTIVE
  agent's tasklists — the `actions:` that name them — never a runtime-wide slug lookup. The run
  state keying follows the same rule.

Tests: `server.taskrun.test.ts` (12: the whole diamond, both drift directions, resume, reset,
reconcile, corrupt state, purity of the explicit-completed path); live gate extended with a real
stdio drift probe. **46/46, `tsc` clean.** `condition`/`forEach` remain model-interpreted
(free text) — unchanged by design.

### The `format-guide` space — the format, taught by the format (2026-09-01)

Requested: "a space about the space format with tasklists on creating knowledge, agents,
tasklists etc". Authored **entirely through the MCP authoring tools** (`mcp/forge-format-guide.mjs`
drives a fresh subprocess against `--root <repoRoot>`): `create_space` → 2 functions → 6
knowledge aspects → 6 tasklist nodes → the agent. The corpus is now `space-probe`, `space-mini`,
`format-guide` (22 files).

- **`functions/`**: `parseRef` (validates `<project>/<space>/<slug>`) and `checkDag` (pure
  unknown-dep + cycle detection) — both extract `exact`; `checkDag` proves array-of-objects with
  a nested string array extracts fully (`items.items`).
- **`knowledge/format/`**: `agents/{frontmatter,files}`, `functions/{extraction,rules}`,
  `tasklists/{dag,running}` — the enforced rules, written as reference an agent loads on demand.
- **`tasklists/author_a_space`**: a comb — `scaffold → {functions, knowledge} → agent → tasklist
  → validate` — the validate node ends in walking the new space's own tasklist.

Two more defects only the live forge caught:

- **Defect 11 — the writer's extraction was OPT-IN.** `validate(candidate, project, extract=false)`:
  most writer call sites never passed `extract`, so `validate_space` and the tasklist/agent
  writers reported freshly-committed functions as `degraded`/"no extractor" with empty schemas —
  the write path lying about the artifact it just wrote (defect 7's class again: a forwarding
  flag the next caller forgets). Extraction is now UNCONDITIONAL on every re-parse; the flag is
  gone.
- **`write_tasklist_node` crashed on an entry node** — `node.dependsOn.length` with a raw
  TypeError (path "") because a first node legitimately omits `dependsOn`. Now defaulted at the
  boundary and the parameter type says so; `format.write.test.ts` (new, 4 tests) pins entry-node
  writes, NN- prefixing, unknown-dep refusal, cycle refusal with no partial file committed.

Authoring-order rule discovered live: `write_agent` validates that its `actions:` tasklist slugs
exist, so a tasklist must be authored BEFORE the agent that binds it (the forge does this).

Also: the runtime moved to the REPO ROOT (`.mcp.json` runs `--root .`) — `.lmthing/default/spaces/`
now sits where a real user's does; the live gate and loader test are anchored to the repo root,
not the process cwd. **50/50 tests, `tsc` clean.**

### First delegated subagent run (2026-09-01) — forger → guide → `hello-forge`

The full delegation chain, live: authored **`forger`** (orchestrator: `functions: []`,
`canDelegateTo: ["format-guide/guide"]`, action `author-a-space`) → `list_delegates` resolved the
two-part entry project-locally → `export_claude_subagents` (inheritTools) wrote
`.claude/agents/format-guide-guide.md` (committed; the harness registered it as a native agent
type) → spawned on the specific action. The subagent drove `author_a_space` through
`start_task`/`complete_task` and produced **`hello-forge`** (10 files, `greet` verdict `exact`),
then proved it usable: the greeter's `welcome` run went `prepare → greet` to `runComplete` with
`inputs.prepare` carried into the `greet` node. Verified in the main session; left uncommitted
run state under `.runs/`.

**Operational finding — a subagent's tool list is its SPAWN-TIME SNAPSHOT.** This spawn happened
while `forger` (`functions: []`) was active, so the subagent saw no `mcp__space__parseRef`/`checkDag`
— it fell back to running the function FILES with `node --experimental-strip-types`. The tools
themselves were never missing (the main session had called both minutes earlier, guide active);
`tools/list_changed` reaches the interactive client, not an already-running subagent's snapshot.
Rule: **`set_agent` to the delegate BEFORE spawning** and the subagent mounts its function tools.

Also confirmed live: knowledge is scoped to the ACTIVE agent (forger's `load_knowledge` refused —
correct; switch to the guide to load); the drift nudges fired on every premature `complete_task`;
and the authoring-order rule held again — the `welcome` tasklist was written before the greeter
that binds it, while the DAG's `agent` node still completed before `tasklist` (file order and
node-completion order are independent). `create_space`'s placeholder `agents/agent` has no delete
tool, but `write_agent slug:"agent"` REPLACES its instruct — the practical removal path.

### The `app-forge` space — project-app creation and iteration (2026-09-02, by a Sonnet subagent)

Spawned a **Sonnet** general-purpose agent (with the guide active, so its tool snapshot carried
`parseRef`/`checkDag`) to author a space about the PROJECT format: read `org/docs/format/project/**`
first, skim a real `store/projects/*`, then build `.lmthing/default/spaces/app-forge/` (27 files)
entirely through the authoring tools. Verified in the main session: `validate_space` clean, both
functions verdict `exact` (`planIteration`'s `"fix" | "polish"` union extracted as a real `enum`),
both DAG forks correct (`create_app`: scaffold → {schema, api} → pages → wire → verify;
`iterate_app`: inspect → plan → {fix, polish} → reverify with condition/forEach over
`planIteration`'s output), agents `agent` (orchestrator, rebranded placeholder) + `builder`.

**The subagent over-ruled my prompt with the docs — correctly.** I sketched pages as `pages/`
directories; the docs say a project page is a **view spec** (`views/<route>.view.json`, the
hand-written-TSX format removed from the codebase entirely), so that is what it taught — and it
flagged the stale `store/projects/demo-feed/pages/index.tsx` as a leftover. The spec lives in
`org/docs/` and loses to nothing.

Also: the loader test now pins the FIXTURE spaces rather than the whole corpus list — the corpus
grows (5 spaces: app-forge, format-guide, hello-forge, space-mini, space-probe) and the test
stopped breaking every time. 50/50, `tsc` clean.

### Cross-harness proof: `agy` (Google Antigravity CLI) authored a space (2026-09-02)

The original pivot requirement was that space agents be usable from MANY harnesses. First
second-harness proof, live through herdr: `agy` 1.1.23 has a native MCP client (`agy mcp add
<name> -- <command> <args…>` — the old "pi/agy have no MCP client" note was true on 08-31 and is
now half false; still true for **pi**). Registered the space server user-level, spawned
`gemini-3.7-flash` in a herdr pane (`agent start --kind agy`, permissions skipped), and gave it a
spec for the **`code-review`** space.

Result, verified from disk + a fresh subprocess (not from agy's claims): 11 files authored
entirely through the MCP tools, `validate_space` clean, `prioritizeFindings` verdict **exact**
with `"blocker" | "nit"` extracted as a real `enum`, and the `review_pr` DAG walks correctly
(`read_diff` → `annotate` → `verdict`). agy followed the tasklist-before-agent ordering rule
without hitting the refusal. Two mechanical notes: Antigravity materializes each MCP tool's JSON
schema to `~/.gemini/antigravity-cli/mcp/<server>/` and the model READS those files before
calling — discovery is file-based; and it left the `agents/agent` placeholder (removed at
integration, per the established pattern) plus needed the `package.json` manifest no tool can
author. **Corpus is now 6 spaces; 50/50 tests, `tsc` clean.**
